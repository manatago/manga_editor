import React from 'react'

const RANGE_CLASS = 'w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600'

const VARIANTS = {
    /** コマ・ページ設定で使う小さめの見出し */
    compact: {
        label: 'text-[10px] text-zinc-500 uppercase',
        value: 'text-[10px] text-blue-500 font-mono'
    },
    /** 吹き出し設定で使う通常サイズの見出し */
    normal: {
        label: 'text-xs text-zinc-400',
        value: 'text-xs text-blue-500 font-mono'
    }
} as const

export interface SliderFieldProps {
    label: React.ReactNode
    /** 見出し右側に出す現在値の表示（単位や % 換算を含む） */
    display: React.ReactNode
    value: number
    min: number
    max: number
    step?: number
    onChange: (value: number) => void
    variant?: keyof typeof VARIANTS
    /** 見出し行の余白クラス（既定 mb-1） */
    headerClassName?: string
    disabled?: boolean
}

/**
 * 「ラベル＋現在値」の見出し行とレンジスライダーの組。
 * 既存レイアウトを崩さないよう、ラッパー要素は持たずフラグメントで返す。
 */
export const SliderField: React.FC<SliderFieldProps> = ({
    label,
    display,
    value,
    min,
    max,
    step,
    onChange,
    variant = 'compact',
    headerClassName = 'mb-1',
    disabled
}) => {
    const v = VARIANTS[variant]
    return (
        <>
            <div className={`flex justify-between ${headerClassName}`}>
                <label className={v.label}>{label}</label>
                <span className={v.value}>{display}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(Number(e.target.value))}
                className={RANGE_CLASS}
            />
        </>
    )
}
