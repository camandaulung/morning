import io
import json

import pytest

import llm_client


class _FakeModels:
    def __init__(self, exc=None, text=None):
        self.exc, self.text, self.calls = exc, text, 0

    def generate_content(self, **_kw):
        self.calls += 1
        if self.exc:
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
