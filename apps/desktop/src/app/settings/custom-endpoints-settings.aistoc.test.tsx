import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AdvancedEndpointFields } from './custom-endpoints-settings'

afterEach(cleanup)

describe('AdvancedEndpointFields', () => {
  it('parses header lines into a record', () => {
    const onChange = vi.fn()
    render(<AdvancedEndpointFields headers={'X-Org: aistoc'} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('额外 Header'), { target: { value: 'X-Org: aistoc\nX-Env: prod' } })
    expect(onChange).toHaveBeenCalledWith({ 'X-Org': 'aistoc', 'X-Env': 'prod' })
  })
})
