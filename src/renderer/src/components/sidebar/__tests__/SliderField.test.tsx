import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SliderField } from '../SliderField'

describe('SliderField', () => {
    it('ラベルと表示値を出し、変更を数値で通知する', () => {
        const onChange = vi.fn()
        render(<SliderField label="回転" display={<>15°</>} value={15} min={-180} max={180} onChange={onChange} />)
        expect(screen.getByText('回転')).toBeInTheDocument()
        expect(screen.getByText('15°')).toBeInTheDocument()

        const input = screen.getByRole('slider') as HTMLInputElement
        expect(input.min).toBe('-180')
        expect(input.max).toBe('180')
        fireEvent.change(input, { target: { value: '-42' } })
        expect(onChange).toHaveBeenCalledWith(-42)
    })

    it('小数ステップの値も数値のまま渡す', () => {
        const onChange = vi.fn()
        render(<SliderField label="不透明度" display="50%" value={0.5} min={0} max={1} step={0.05} onChange={onChange} />)
        fireEvent.change(screen.getByRole('slider'), { target: { value: '0.35' } })
        expect(onChange).toHaveBeenCalledWith(0.35)
    })

    it('variant で見出しの文字サイズが切り替わる', () => {
        const { rerender } = render(<SliderField label="A" display="1" value={1} min={0} max={2} onChange={() => {}} />)
        expect(screen.getByText('A').className).toContain('text-[10px]')
        rerender(<SliderField label="A" display="1" value={1} min={0} max={2} onChange={() => {}} variant="normal" />)
        expect(screen.getByText('A').className).toContain('text-xs')
    })
})
