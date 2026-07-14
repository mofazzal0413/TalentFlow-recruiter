import pytest

from talentflow.agent import run


@pytest.fixture
def agent_output() -> str:
    return run()
