import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CustomEndpointUpdate } from '@/types/hermes'

import { AISTOC_PRESETS, type AistocPreset, presetToEndpoint } from './providers'

export interface AistocSetupResult {
  ok: boolean
  message?: string
  needsModelInput?: boolean
}

export function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {}

  for (const line of text.split('\n')) {
    const index = line.indexOf(':')

    if (index > 0) {
      headers[line.slice(0, index).trim()] = line.slice(index + 1).trim()
    }
  }

  return headers
}

export function AistocSetup({
  save
}: {
  save: (endpoint: CustomEndpointUpdate) => Promise<AistocSetupResult>
}) {
  const [preset, setPreset] = useState<AistocPreset | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [extraHeaders, setExtraHeaders] = useState('')
  const [sslVerify, setSslVerify] = useState(true)
  const [sslCaCert, setSslCaCert] = useState('')
  const [allowHttp, setAllowHttp] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const choosePreset = (next: AistocPreset) => {
    setPreset(next)
    setBaseUrl(next.baseUrl)
    setModel(next.model)
    setError('')
  }

  const submit = async () => {
    const base: CustomEndpointUpdate = preset
      ? presetToEndpoint(preset, apiKey)
      : { name: '自定义端点', base_url: baseUrl, model, api_key: apiKey, make_default: true }

    const endpoint: CustomEndpointUpdate = {
      ...base,
      base_url: baseUrl.trim() || base.base_url,
      model: model.trim() || base.model,
      extra_headers: parseHeaders(extraHeaders),
      ssl_verify: sslVerify,
      ssl_ca_cert: sslCaCert.trim() || undefined
    }

    if (!endpoint.base_url || !endpoint.model) {
      setError('请填写接口地址和模型名')

      return
    }

    if (endpoint.base_url.startsWith('http://') && !allowHttp) {
      setError('HTTP 地址需要允许 HTTP 传输：请勾选“允许明文 HTTP（不加密传输）”')

      return
    }

    setSaving(true)
    setError('')
    const result = await save(endpoint)
    setSaving(false)

    if (!result.ok) {setError(result.message ?? '保存失败')}
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold">连接你的模型服务</h2>
        <p className="text-sm text-muted-foreground">选择厂商预设，或填写内网自建服务的 OpenAI 兼容地址。</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {AISTOC_PRESETS.map(item => (
          <Button
            key={item.id}
            onClick={() => choosePreset(item)}
            type="button"
            variant={preset?.id === item.id ? 'default' : 'outline'}
          >
            {item.name}
          </Button>
        ))}
        <Button
          onClick={() => {
            setPreset(null)
            setBaseUrl('')
            setModel('')
            setError('')
          }}
          type="button"
          variant={preset === null ? 'default' : 'outline'}
        >
          自定义 / 内网服务
        </Button>
      </div>

      <label className="grid gap-1 text-sm">
        <span>接口地址</span>
        <Input
          aria-label="接口地址"
          onChange={event => setBaseUrl(event.target.value)}
          placeholder="https://api.example.com/v1"
          value={baseUrl}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input checked={allowHttp} onChange={event => setAllowHttp(event.target.checked)} type="checkbox" />
        允许明文 HTTP（不加密传输）
      </label>
      <label className="grid gap-1 text-sm">
        <span>API Key</span>
        <Input aria-label="API Key" onChange={event => setApiKey(event.target.value)} type="password" value={apiKey} />
      </label>
      <label className="grid gap-1 text-sm">
        <span>模型名</span>
        <Input
          aria-label="模型名"
          onChange={event => setModel(event.target.value)}
          placeholder="deepseek-chat"
          value={model}
        />
      </label>

      <Button onClick={() => setShowAdvanced(value => !value)} type="button" variant="text">
        {showAdvanced ? '收起高级选项' : '高级选项'}
      </Button>

      {showAdvanced ? (
        <div className="grid gap-3 rounded-lg border p-3">
          <label className="grid gap-1 text-sm">
            <span>额外 Header</span>
            <textarea
              aria-label="额外 Header"
              className="min-h-20 rounded-md border bg-background p-2 font-mono text-xs"
              onChange={event => setExtraHeaders(event.target.value)}
              placeholder={'X-Org: aistoc\nX-Env: prod'}
              value={extraHeaders}
            />
            <span className="text-xs text-muted-foreground">每行一个，格式：Header-Name: value</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input checked={sslVerify} onChange={event => setSslVerify(event.target.checked)} type="checkbox" />
            校验 TLS 证书（内网自签证书可关闭）
          </label>
          <label className="grid gap-1 text-sm">
            <span>自定义 CA 证书路径（可选）</span>
            <Input
              aria-label="自定义 CA 证书路径"
              onChange={event => setSslCaCert(event.target.value)}
              placeholder={'C:\\certs\\internal-ca.pem'}
              value={sslCaCert}
            />
          </label>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button disabled={saving} onClick={() => void submit()} type="button">
        {saving ? '测试中…' : '保存并测试'}
      </Button>
    </div>
  )
}
