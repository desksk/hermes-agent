import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AistocSetup } from './AistocSetup'

afterEach(cleanup)

describe('AistocSetup', () => {
  it('fills the form from a vendor preset and saves it', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true })
    render(<AistocSetup save={save} />)

    fireEvent.click(screen.getByRole('button', { name: /DeepSeek/ }))
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test' } })
    fireEvent.click(screen.getByRole('button', { name: '保存并测试' }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0][0]).toMatchObject({
      base_url: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      api_key: 'sk-test'
    })
  })

  it('shows a readable error when the endpoint fails', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, message: '证书无效' })
    render(<AistocSetup save={save} />)
    fireEvent.click(screen.getByRole('button', { name: /DeepSeek/ }))
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test' } })
    fireEvent.click(screen.getByRole('button', { name: '保存并测试' }))
    expect(await screen.findByText('证书无效')).toBeTruthy()
  })

  it('blocks plain HTTP unless explicitly allowed', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true })
    render(<AistocSetup save={save} />)
    fireEvent.click(screen.getByRole('button', { name: /自定义/ }))
    fireEvent.change(screen.getByLabelText('接口地址'), { target: { value: 'http://10.0.0.2:8000/v1' } })
    fireEvent.change(screen.getByLabelText('模型名'), { target: { value: 'qwen-plus' } })
    fireEvent.click(screen.getByRole('button', { name: '保存并测试' }))
    expect(await screen.findByText(/允许 HTTP/)).toBeTruthy()
    expect(save).not.toHaveBeenCalled()
  })

  it('sends custom headers and TLS settings', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true })
    render(<AistocSetup save={save} />)
    fireEvent.click(screen.getByRole('button', { name: /自定义/ }))
    fireEvent.change(screen.getByLabelText('接口地址'), { target: { value: 'https://gw.internal/v1' } })
    fireEvent.change(screen.getByLabelText('模型名'), { target: { value: 'qwen-plus' } })
    fireEvent.click(screen.getByRole('button', { name: '高级选项' }))
    fireEvent.change(screen.getByLabelText('额外 Header'), { target: { value: 'X-Org: aistoc' } })
    fireEvent.click(screen.getByLabelText('校验 TLS 证书（内网自签证书可关闭）'))
    fireEvent.click(screen.getByRole('button', { name: '保存并测试' }))
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(save.mock.calls[0][0]).toMatchObject({
      extra_headers: { 'X-Org': 'aistoc' },
      ssl_verify: false
    })
  })
})
