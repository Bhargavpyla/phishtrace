"""Offline smoke-test checks; no real model calls or credentials are used."""
import runpy
from pathlib import Path
from types import SimpleNamespace

import pytest
from google import genai


@pytest.mark.parametrize('failure', [None, 'plain', 'structured', 'missing_tool', 'wrong_tool'])
def test_smoke_loads_project_env_and_fails_on_bad_responses(tmp_path, monkeypatch, failure):
    script = tmp_path / 'project' / 'scripts' / 'smoke_test.py'
    script.parent.mkdir(parents=True)
    script.write_text((Path(__file__).resolve().parents[1] / 'scripts' / 'smoke_test.py').read_text())
    (script.parent.parent / '.env').write_text('GEMINI_API_KEY=synthetic-test-key\nGEMINI_MODEL=test-model\n')
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    monkeypatch.delenv('GEMINI_MODEL', raising=False)
    monkeypatch.chdir(tmp_path)  # configuration must not depend on cwd
    calls = []

    def generate_content(**kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            return SimpleNamespace(text='wrong' if failure == 'plain' else 'OK')
        if len(calls) == 2:
            parsed = None if failure == 'structured' else {
                'label': 'needs_investigation', 'findings': [], 'unknowns': ['Synthetic test']}
            return SimpleNamespace(parsed=parsed)
        requested = [] if failure == 'missing_tool' else [SimpleNamespace(
            name='delete_email' if failure == 'wrong_tool' else 'inspect_sender',
            args={'sender': 'helpdesk@acme-corp-login.example'})]
        return SimpleNamespace(function_calls=requested)

    def client(api_key):
        assert api_key == 'synthetic-test-key'
        return SimpleNamespace(models=SimpleNamespace(
            list=lambda: [SimpleNamespace(name='models/test-flash')],
            generate_content=generate_content))

    monkeypatch.setattr(genai, 'Client', client)
    if failure:
        with pytest.raises(SystemExit) as exc:
            runpy.run_path(str(script))
        assert str(exc.value).startswith('FAILED')
    else:
        runpy.run_path(str(script))
        assert len(calls) == 3
    assert all(c['model'] == 'test-model' for c in calls)


def test_smoke_environment_takes_precedence_and_missing_model_makes_no_generation(tmp_path, monkeypatch):
    script = tmp_path / 'project' / 'scripts' / 'smoke_test.py'
    script.parent.mkdir(parents=True)
    script.write_text((Path(__file__).resolve().parents[1] / 'scripts' / 'smoke_test.py').read_text())
    (script.parent.parent / '.env').write_text('GEMINI_API_KEY=file-key\nGEMINI_MODEL=file-model\n')
    monkeypatch.setenv('GEMINI_API_KEY', 'environment-key')
    monkeypatch.setenv('GEMINI_MODEL', '')

    def client(api_key):
        assert api_key == 'environment-key'
        return SimpleNamespace(models=SimpleNamespace(list=lambda: []))

    monkeypatch.setattr(genai, 'Client', client)
    with pytest.raises(SystemExit, match='Pick a model ID'):
        runpy.run_path(str(script))
