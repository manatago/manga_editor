import React from 'react'
import { Group, Text } from 'react-konva'
import { FilteredText } from './FilteredText'
import {
    VERTICAL_PUNCT_OFFSETS,
    VERTICAL_ROTATE_CHARS,
    VERTICAL_ROTATE_LOW_CHARS,
    VERTICAL_ROTATE_LOW_SHIFT,
    VERTICAL_SMALL_CHARS
} from './speechTextVerticalGlyphs'
import { BUBBLE_TEXT_DISTRESS_SCALE, heavyStrokeWidthFor } from './utils/bubbleTextLayout'

export const VerticalText: React.FC<{
    text: string;
    fontSize: number;
    fontColor: string;
    strokeColor?: string;
    strokeWidth?: number;
    weightLevel?: 0 | 1 | 2;
    roughness?: number;
    fontFamily?: string;
    fontWeight?: string;
    width: number;
    height: number;
    lineHeight?: number;
    letterSpacing?: number;
}> = ({ text, fontSize, fontColor, strokeColor, strokeWidth, weightLevel = 1, roughness = 0, fontFamily = 'sans-serif', fontWeight = 'bold', width, height, lineHeight = 1.4, letterSpacing = 0 }) => {
    const lines = text.split('\n')
    const charSpacing = letterSpacing
    const columnSpacing = fontSize * lineHeight * 0.6
    const totalColumnsWidth = lines.length * fontSize + (lines.length - 1) * columnSpacing
    // 各列 Group は左上原点で fontSize 幅の文字ボックスを描く。最右列(lineIdx=0)の
    // 右端を tw/2 + totalColumnsWidth/2 に揃えるため、Group.x = (右端) - fontSize で計算する。
    const startX = width / 2 + totalColumnsWidth / 2 - fontSize
    // 各列を垂直方向に中央揃えする（横書きの verticalAlign:'middle' と挙動を合わせる）。
    // 一番長い列を基準にブロック全体を中央へ寄せ、列内は従来通り上揃え（短い列は上端から始まる）。
    let tallestColumnHeight = 0
    for (const line of lines) {
        const n = Array.from(line).length
        if (n === 0) continue
        const h = n * fontSize + (n - 1) * charSpacing
        if (h > tallestColumnHeight) tallestColumnHeight = h
    }
    const yBlockOffset = Math.max(0, (height - tallestColumnHeight) / 2)
    const heavyStrokeWidth = heavyStrokeWidthFor(weightLevel, fontSize)
    const distress = Math.max(0, Math.min(1, roughness))
    const outlineW = strokeWidth && strokeWidth > 0 ? strokeWidth : 0
    const outlineColor = strokeColor ?? '#ffffff'

    return (
        <Group y={yBlockOffset}>
            {lines.map((line, lineIdx) => {
                const chars = line.split('')
                return (
                    <Group key={lineIdx} x={startX - lineIdx * (fontSize + columnSpacing)}>
                        {chars.map((char, charIdx) => {
                            let rotation = 0
                            let xOffset = 0
                            let charYOffset = 0

                            if (VERTICAL_ROTATE_CHARS.includes(char)) {
                                rotation = 90
                                xOffset = fontSize
                                // …‥ は回転すると列の片側へ寄るので中央へ補正
                                if (VERTICAL_ROTATE_LOW_CHARS.includes(char)) {
                                    xOffset += fontSize * VERTICAL_ROTATE_LOW_SHIFT
                                }
                            } else if (VERTICAL_SMALL_CHARS.includes(char)) {
                                xOffset = fontSize * 0.2
                                charYOffset = -fontSize * 0.1
                            } else if (VERTICAL_PUNCT_OFFSETS[char]) {
                                xOffset = fontSize * VERTICAL_PUNCT_OFFSETS[char].x
                                charYOffset = fontSize * VERTICAL_PUNCT_OFFSETS[char].y
                            }

                            return (
                                <Group key={charIdx}>
                                    {outlineW > 0 && (
                                        <FilteredText
                                            text={char}
                                            x={xOffset}
                                            y={charIdx * (fontSize + charSpacing) + charYOffset}
                                            fontSize={fontSize}
                                            fill={outlineColor}
                                            stroke={outlineColor}
                                            strokeWidth={outlineW * 2}
                                            lineJoin="round"
                                            fontFamily={fontFamily}
                                            align="center"
                                            width={fontSize}
                                            rotation={rotation}
                                            fontStyle={fontWeight}
                                            distressStrength={distress}
                                            distressScale={BUBBLE_TEXT_DISTRESS_SCALE}
                                            enableCache={distress > 0}
                                        />
                                    )}
                                    {weightLevel === 2 && (
                                        <FilteredText
                                            text={char}
                                            x={xOffset}
                                            y={charIdx * (fontSize + charSpacing) + charYOffset}
                                            fontSize={fontSize}
                                            fill={fontColor}
                                            stroke={fontColor}
                                            strokeWidth={heavyStrokeWidth}
                                            lineJoin="round"
                                            fontFamily={fontFamily}
                                            align="center"
                                            width={fontSize}
                                            rotation={rotation}
                                            fontStyle={fontWeight}
                                            distressStrength={distress}
                                            distressScale={BUBBLE_TEXT_DISTRESS_SCALE}
                                            enableCache={distress > 0}
                                        />
                                    )}
                                    <FilteredText
                                        text={char}
                                        x={xOffset}
                                        y={charIdx * (fontSize + charSpacing) + charYOffset}
                                        fontSize={fontSize}
                                        fill={fontColor}
                                        lineJoin="round"
                                        fontFamily={fontFamily}
                                        align="center"
                                        width={fontSize}
                                        rotation={rotation}
                                        fontStyle={fontWeight}
                                        distressStrength={distress}
                                        distressScale={BUBBLE_TEXT_DISTRESS_SCALE}
                                        enableCache={distress > 0}
                                    />
                                </Group>
                            )
                        })}
                    </Group>
                )
            })}
        </Group>
    )
}

export const MegaphoneText: React.FC<{
    text: string;
    fontSize: number;
    fontColor: string;
    strokeColor?: string;
    strokeWidth?: number;
    weightLevel?: 0 | 1 | 2;
    roughness?: number;
    fontFamily: string;
    fontWeight: string;
    width: number;
    height: number;
    narrowRatio: number;
    isVertical: boolean;
    lineHeight: number;
    letterSpacing?: number;
}> = ({ text, fontSize, fontColor, strokeColor, strokeWidth, weightLevel = 1, roughness = 0, fontFamily, fontWeight, width, height, narrowRatio, isVertical, lineHeight, letterSpacing = 0 }) => {
    const lines = text.split('\n').filter((_, i) => i < 20)
    const n = lines.length
    const ratio = narrowRatio || 0.3
    const heavyStrokeWidth = heavyStrokeWidthFor(weightLevel, fontSize)
    const distress = Math.max(0, Math.min(1, roughness))
    const outlineW = strokeWidth && strokeWidth > 0 ? strokeWidth : 0
    const outlineColor = strokeColor ?? '#ffffff'

    if (isVertical) {
        const columnGap = fontSize * lineHeight * 0.6
        const totalWidth = lines.length * fontSize + (lines.length - 1) * columnGap
        const startX = (width - totalWidth) / 2

        return (
            <Group>
                {lines.map((line, lineIdx) => {
                    const chars = line.split('')
                    const m = chars.length
                    let currentY = 0
                    const charData = chars.map((char, charIdx) => {
                        const t = m <= 1 ? 0.5 : charIdx / (m - 1)
                        const scale = 1 - t * (1 - ratio)
                        const charFontSize = Math.max(4, Math.round(fontSize * scale))
                        const y = currentY
                        currentY += charFontSize * 1.1 + letterSpacing
                        return { char, fontSize: charFontSize, y }
                    })

                    const blockHeight = currentY
                    const yOffsetTop = (height - blockHeight) / 2

                    return (
                        <Group key={lineIdx} x={startX + (lines.length - 1 - lineIdx) * (fontSize + columnGap)} y={yOffsetTop}>
                            {charData.map((data, charIdx) => {
                                let charRotation = 0
                                let xCharOffset = (fontSize - data.fontSize) / 2
                                let yCharOffset = 0

                                if (VERTICAL_ROTATE_CHARS.includes(data.char)) {
                                    charRotation = 90
                                    xCharOffset += data.fontSize
                                    if (VERTICAL_ROTATE_LOW_CHARS.includes(data.char)) {
                                        xCharOffset += data.fontSize * VERTICAL_ROTATE_LOW_SHIFT
                                    }
                                } else if (VERTICAL_SMALL_CHARS.includes(data.char)) {
                                    xCharOffset += data.fontSize * 0.2
                                    yCharOffset = -data.fontSize * 0.1
                                } else if (VERTICAL_PUNCT_OFFSETS[data.char]) {
                                    xCharOffset += data.fontSize * VERTICAL_PUNCT_OFFSETS[data.char].x
                                    yCharOffset = data.fontSize * VERTICAL_PUNCT_OFFSETS[data.char].y
                                }

                                return (
                                    <Group key={charIdx}>
                                        {outlineW > 0 && (
                                            <FilteredText
                                                text={data.char}
                                                x={xCharOffset}
                                                y={data.y + yCharOffset}
                                                fontSize={data.fontSize}
                                                fill={outlineColor}
                                                stroke={outlineColor}
                                                strokeWidth={outlineW * 2}
                                                lineJoin="round"
                                                fontFamily={fontFamily}
                                                fontStyle={fontWeight}
                                                rotation={charRotation}
                                                align="center"
                                                width={data.fontSize}
                                                distressStrength={distress}
                                                distressScale={BUBBLE_TEXT_DISTRESS_SCALE}
                                                enableCache={distress > 0}
                                            />
                                        )}
                                        {weightLevel === 2 && (
                                            <FilteredText
                                                text={data.char}
                                                x={xCharOffset}
                                                y={data.y + yCharOffset}
                                                fontSize={data.fontSize}
                                                fill={fontColor}
                                                stroke={fontColor}
                                                strokeWidth={heavyStrokeWidth}
                                                lineJoin="round"
                                                fontFamily={fontFamily}
                                                fontStyle={fontWeight}
                                                rotation={charRotation}
                                                align="center"
                                                width={data.fontSize}
                                                distressStrength={distress}
                                                distressScale={BUBBLE_TEXT_DISTRESS_SCALE}
                                                enableCache={distress > 0}
                                            />
                                        )}
                                        <FilteredText
                                            text={data.char}
                                            x={xCharOffset}
                                            y={data.y + yCharOffset}
                                            fontSize={data.fontSize}
                                            fill={fontColor}
                                            lineJoin="round"
                                            fontFamily={fontFamily}
                                            fontStyle={fontWeight}
                                            rotation={charRotation}
                                            align="center"
                                            width={data.fontSize}
                                            distressStrength={distress}
                                            distressScale={BUBBLE_TEXT_DISTRESS_SCALE}
                                            enableCache={distress > 0}
                                        />
                                    </Group>
                                )
                            })}
                        </Group>
                    )
                })}
            </Group>
        )
    }

    let currentY = 0
    const lineData = lines.map((line, i) => {
        const t = n <= 1 ? 0.5 : i / (n - 1)
        const scale = 1 - t * (1 - ratio)
        const lineFontSize = Math.max(4, Math.round(fontSize * scale))
        const y = currentY
        currentY += lineFontSize * lineHeight
        return { line, fontSize: lineFontSize, y, lineW: width * scale }
    })

    const yOffsetTop = (height - currentY) / 2

    return (
        <Group y={yOffsetTop}>
            {lineData.map((data, i) => (
                <Group key={i}>
                    {outlineW > 0 && (
                        <FilteredText
                            text={data.line}
                            x={(width - data.lineW) / 2}
                            y={data.y}
                            width={data.lineW}
                            fontSize={data.fontSize}
                            fill={outlineColor}
                            stroke={outlineColor}
                            strokeWidth={outlineW * 2}
                            lineJoin="round"
                            fontFamily={fontFamily}
                            fontStyle={fontWeight}
                            align="center"
                            letterSpacing={letterSpacing}
                            distressStrength={distress}
                            distressScale={BUBBLE_TEXT_DISTRESS_SCALE}
                            enableCache={distress > 0}
                        />
                    )}
                    {weightLevel === 2 && (
                        <FilteredText
                            text={data.line}
                            x={(width - data.lineW) / 2}
                            y={data.y}
                            width={data.lineW}
                            fontSize={data.fontSize}
                            fill={fontColor}
                            stroke={fontColor}
                            strokeWidth={heavyStrokeWidth}
                            lineJoin="round"
                            fontFamily={fontFamily}
                            fontStyle={fontWeight}
                            align="center"
                            letterSpacing={letterSpacing}
                            distressStrength={distress}
                            distressScale={BUBBLE_TEXT_DISTRESS_SCALE}
                            enableCache={distress > 0}
                        />
                    )}
                    <FilteredText
                        text={data.line}
                        x={(width - data.lineW) / 2}
                        y={data.y}
                        width={data.lineW}
                        fontSize={data.fontSize}
                        fill={fontColor}
                        lineJoin="round"
                        fontFamily={fontFamily}
                        fontStyle={fontWeight}
                        align="center"
                        letterSpacing={letterSpacing}
                        distressStrength={distress}
                        distressScale={BUBBLE_TEXT_DISTRESS_SCALE}
                        enableCache={distress > 0}
                    />
                </Group>
            ))}
        </Group>
    )
}
