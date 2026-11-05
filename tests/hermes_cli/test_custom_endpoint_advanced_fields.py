"""Custom endpoint saves carry extra headers and TLS settings through to providers."""

from hermes_cli.web_models import CustomEndpointUpdate
from hermes_cli.web_routers.config_env import _write_custom_endpoint


def test_write_custom_endpoint_persists_headers_and_tls():
    cfg = {"providers": {}}
    body = CustomEndpointUpdate(
        name="internal-gateway",
        base_url="https://llm.internal.example.com/v1",
        model="qwen-plus",
        api_key="secret",
        extra_headers={"X-Org": "aistoc", "X-Unused": None},
        ssl_verify=False,
        ssl_ca_cert="/etc/ssl/internal-ca.pem",
    )
    endpoint_id, entry = _write_custom_endpoint(cfg, body)
    assert endpoint_id == "internal-gateway"
    assert entry["extra_headers"] == {"X-Org": "aistoc"}
    assert entry["ssl_verify"] is False
    assert entry["ssl_ca_cert"] == "/etc/ssl/internal-ca.pem"


def test_write_custom_endpoint_none_keeps_existing_fields():
    cfg = {
        "providers": {
            "gw": {
                "name": "gw",
                "base_url": "https://gw.example.com/v1",
                "model": "m",
                "extra_headers": {"X-Keep": "1"},
                "ssl_verify": True,
            }
        }
    }
    body = CustomEndpointUpdate(id="gw", name="gw", base_url="https://gw.example.com/v1", model="m2")
    _, entry = _write_custom_endpoint(cfg, body)
    assert entry["extra_headers"] == {"X-Keep": "1"}
    assert entry["ssl_verify"] is True
