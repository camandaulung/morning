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


def test_free_tier_daily_quota_switches_to_openai_for_the_run(env, monkeypatch):
    err = Exception("429 RESOURCE_EXHAUSTED. quotaId: GenerateRequestsPerDayPerProjectPerModel-FreeTier")
    models = _FakeModels(exc=err)
    _gemini(monkeypatch, models)
    assert llm_client.call_llm("x", retries=2) == ('{"tech": []}', set())
    assert models.calls == 1 and llm_client._gemini_exhausted is True
    assert len(env) == 1


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
