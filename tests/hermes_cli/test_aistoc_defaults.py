"""AISTOC offline distribution: no update checks, telemetry, or remote catalog."""

from hermes_cli.config_defaults import DEFAULT_CONFIG


def test_updates_disabled_for_offline_distribution():
    assert DEFAULT_CONFIG["updates"]["check"] is False


def test_remote_model_catalog_disabled():
    assert DEFAULT_CONFIG["model_catalog"]["enabled"] is False


def test_telemetry_stays_off():
    metrics = DEFAULT_CONFIG["telemetry"]["shared_metrics"]
    assert metrics["enabled"] is False
    assert metrics["send"] is False
