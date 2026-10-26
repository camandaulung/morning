import io
import json

import pytest

import llm_client


class _FakeModels:
    def __init__(self, exc=None, text=None, fail_times=None):
        self.exc, self.text, self.calls = exc, text, 0
        self.fail_times = fail_times  # None = always raise exc

    def generate_content(self, **_kw):
        self.calls += 1
        if self.exc and (self.fail_times is None or self.calls <= self.fail_times):
            raise self.exc
        part = type("P", (), {"text": self.text, "thought": False})()
        cand = type("C", (), {"content": type("X", (), {"parts": [part]})(), "grounding_metadata": None})()
        return type("R", (), {"candidates": [cand]})()


class _FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "g")
    monkeypatch.setenv("OPENAI_API_KEY", "o")
    monkeypatch.setattr(llm_client, "_gemini_exhausted", False)
    monkeypatch.setattr(llm_client, "GEMINI_RPM", 0)
    monkeypatch.setattr(llm_client, "_active_model", None)
    monkeypatch.setattr(llm_client, "_no_thinking", False)
    monkeypatch.setattr(llm_client, "_openai_exhausted", False)
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    sleeps = []
    monkeypatch.setattr(llm_client, "_sleep", sleeps.append)
    monkeypatch.setattr(llm_client, "_test_sleeps", sleeps, raising=False)
    openai_calls = []

    def fake_urlopen(req, timeout=0):
        openai_calls.append(json.loads(req.data))
        return _FakeResp(json.dumps({"choices": [{"message": {"content": '{"tech": []}'}}]}).encode())

    monkeypatch.setattr(llm_client.urllib.request, "urlopen", fake_urlopen)
    return openai_calls


def _gemini(monkeypatch, models):
    monkeypatch.setattr(llm_client, "_gemini_client", lambda: type("Cl", (), {"models": models})())


def test_gemini_success_does_not_touch_openai(env, monkeypatch):
    models = _FakeModels(text='{"tech": [1]}')
    _gemini(monkeypatch, models)
    assert llm_client.call_llm("JSON please") == ('{"tech": [1]}', set())
    assert env == []


def test_quota_error_falls_back_to_openai_without_extra_retries(env, monkeypatch):
    models = _FakeModels(exc=Exception("402 RESOURCE_EXHAUSTED. prepayment credits are depleted"))
    _gemini(monkeypatch, models)
    text, urls = llm_client.call_llm("JSON please", retries=2)
    assert (text, urls) == ('{"tech": []}', set())
    assert models.calls == 1                      # stopped retrying on quota
    assert env[0]["model"] == "gpt-4o-mini"
    assert env[0]["max_tokens"] == 16000          # capped from default 32768

    # Later calls in the same run skip Gemini entirely
    llm_client.call_llm("JSON again")
    assert models.calls == 1
    assert len(env) == 2


def test_no_openai_key_returns_none(env, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY")
    _gemini(monkeypatch, _FakeModels(exc=Exception("429 quota")))
    assert llm_client.call_llm("x") == (None, set())
    assert env == []


def test_free_tier_per_minute_429_backs_off_and_retries(env, monkeypatch):
    """A per-minute rate limit (free tier) must wait retryDelay and retry Gemini,
    not abandon it for the whole run."""
    err = Exception("429 RESOURCE_EXHAUSTED. Quota exceeded for metric "
                    "generate_content_free_tier_requests, quotaId: GenerateRequestsPerMinutePerProjectPerModel-FreeTier "
                    "{'@type': 'type.googleapis.com/google.rpc.RetryInfo', 'retryDelay': '23s'}")
    models = _FakeModels(exc=err, text='{"tech": [1]}', fail_times=1)
    _gemini(monkeypatch, models)
    assert llm_client.call_llm("x", retries=2) == ('{"tech": [1]}', set())
    assert models.calls == 2
    assert llm_client._test_sleeps == [24.0]
    assert llm_client._gemini_exhausted is False
    assert env == []


def test_free_tier_daily_quota_on_both_models_switches_to_openai(env, monkeypatch):
    err = Exception("429 RESOURCE_EXHAUSTED. quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier")
    models = _FakeModels(exc=err)
    _gemini(monkeypatch, models)
    assert llm_client.call_llm("x", retries=2) == ('{"tech": []}', set())
    assert models.calls == 2 and llm_client._gemini_exhausted is True   # main model, then lite
    assert len(env) == 1


def test_daily_quota_on_main_model_moves_run_to_lite(env, monkeypatch):
    daily = "429 RESOURCE_EXHAUSTED. quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier"
    models = _RecordingModels(lambda m, c: daily if m == "gemini-3.8-flash" else None)
    _gemini(monkeypatch, models)
    assert llm_client.call_llm("x") == ('{"tech": [1]}', set())
    llm_client.call_llm("y")
    assert [m for m, _ in models.calls] == ["gemini-3.8-flash", "gemini-flash-lite-latest", "gemini-flash-lite-latest"]
    assert llm_client._gemini_exhausted is False and env == []


def test_quota_brief_extracts_quota_ids():
    e = Exception("429 ... 'quotaId': 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' ... quotaId: X-1")
    assert llm_client._quota_brief(e) == "GenerateRequestsPerDayPerProjectPerModel-FreeTier, X-1"


def test_wait_for_slot_spaces_calls(monkeypatch):
    sleeps = []
    monkeypatch.setattr(llm_client, "_sleep", sleeps.append)
    monkeypatch.setattr(llm_client, "GEMINI_RPM", 6)       # 10s apart
    monkeypatch.setattr(llm_client, "_next_slot", 0.0)
    monkeypatch.setattr(llm_client.time, "monotonic", lambda: 100.0)
    llm_client._wait_for_slot()
    llm_client._wait_for_slot()
    llm_client._wait_for_slot()
    assert sleeps == [10.0, 20.0]


class _RecordingModels:
    """generate_content that fails per model / per config, recording each call."""
    def __init__(self, fail):
        self.fail, self.calls = fail, []

    def generate_content(self, model, contents, config):
        self.calls.append((model, config.thinking_config is not None))
        err = self.fail(model, config)
        if err:
            raise Exception(err)
        part = type("P", (), {"text": '{"tech": [1]}', "thought": False})()
        cand = type("C", (), {"content": type("X", (), {"parts": [part]})(), "grounding_metadata": None})()
        return type("R", (), {"candidates": [cand]})()


def test_default_model_is_current_flash(env, monkeypatch):
    models = _RecordingModels(lambda m, c: None)
    _gemini(monkeypatch, models)
    llm_client.call_llm("x")
    assert models.calls[0][0] == "gemini-3.8-flash"


def test_model_404_switches_to_fallback_and_sticks(env, monkeypatch):
    """2026-10-26: 'models/gemini-2.5-flash is no longer available to new users'."""
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash")
    retired = ("404 NOT_FOUND. {'error': {'code': 404, 'message': 'This model models/gemini-2.5-flash "
               "is no longer available to new users.', 'status': 'NOT_FOUND'}}")
    models = _RecordingModels(lambda m, c: retired if m == "gemini-2.5-flash" else None)
    _gemini(monkeypatch, models)
    assert llm_client.call_llm("x", retries=0) == ('{"tech": [1]}', set())
    assert [m for m, _ in models.calls] == ["gemini-2.5-flash", "gemini-flash-latest"]
    llm_client.call_llm("again", retries=0)
    assert models.calls[-1][0] == "gemini-flash-latest"   # no second 404 round-trip
    assert env == []


def test_thinking_budget_rejected_retries_without_it(env, monkeypatch):
    bad = "400 INVALID_ARGUMENT. thinking_budget is not supported for this model; use thinking_level"
    models = _RecordingModels(lambda m, c: bad if c.thinking_config is not None else None)
    _gemini(monkeypatch, models)
    assert llm_client.call_llm("x", retries=0) == ('{"tech": [1]}', set())
    assert [t for _, t in models.calls] == [True, False]
    assert env == []


def test_per_minute_429_with_billing_wording_is_not_treated_as_exhausted(env, monkeypatch):
    """Google's per-minute 429 text says 'check your plan and billing details'."""
    err = Exception("429 RESOURCE_EXHAUSTED. You exceeded your current quota, please check your plan and "
                    "billing details. quotaId: GenerateRequestsPerMinutePerProjectPerModel-FreeTier, "
                    "'retryDelay': '7s'")
    models = _FakeModels(exc=err, text='{"tech": [1]}', fail_times=1)
    _gemini(monkeypatch, models)
    assert llm_client.call_llm("x", retries=2) == ('{"tech": [1]}', set())
    assert llm_client._gemini_exhausted is False
    assert env == []


def test_503_overload_waits_then_retries(env, monkeypatch):
    err = Exception("503 UNAVAILABLE. This model is currently experiencing high demand.")
    models = _FakeModels(exc=err, text='{"tech": [1]}', fail_times=1)
    _gemini(monkeypatch, models)
    assert llm_client.call_llm("x", retries=2) == ('{"tech": [1]}', set())
    assert llm_client._test_sleeps == [15.0]


def test_503_after_retries_tries_lite_model_once(env, monkeypatch):
    busy = "503 UNAVAILABLE. This model is currently experiencing high demand."
    models = _RecordingModels(lambda m, c: busy if m == "gemini-3.8-flash" else None)
    _gemini(monkeypatch, models)
    assert llm_client.call_llm("x", retries=1) == ('{"tech": [1]}', set())
    assert [m for m, _ in models.calls] == ["gemini-3.8-flash", "gemini-3.8-flash", "gemini-flash-lite-latest"]
    assert llm_client._active_model is None          # not sticky: next call tries the main model again
    assert env == []


def test_openai_out_of_credits_is_called_once_per_run(env, monkeypatch):
    import urllib.error
    calls = []
    def no_credit(req, timeout=0):
        calls.append(1)
        raise urllib.error.HTTPError("u", 429, "x", {}, io.BytesIO(b'{"error":{"type":"insufficient_quota","code":"credit_balance_exhausted"}}'))
    monkeypatch.setattr(llm_client.urllib.request, "urlopen", no_credit)
    monkeypatch.setattr(llm_client, "_gemini_exhausted", True)
    assert llm_client.call_llm("a") == (None, set())
    assert llm_client.call_llm("b") == (None, set())
    assert len(calls) == 1
