import React from 'react'
import { Group, Text } from 'react-konva'

export const VerticalText: React.FC<{
    text: string;
    fontSize: number;
    fontColor: string;
    fontFamily?: string;
    fontWeight?: string;
    width: number;
    height: number;
    lineHeight?: number;
}> = ({ text, fontSize, fontColor, fontFamily = 'sans-serif', fontWeight = 'bold', width, height, lineHeight = 1.4 }) => {
    const lines = text.split('\n')
    const charSpacing = 0
    const columnSpacing = fontSize * lineHeight * 0.6
    const totalColumnsWidth = lines.length * fontSize + (lines.length - 1) * columnSpacing
    const startX = width / 2 + totalColumnsWidth / 2 - fontSize / 2

    // Characters that need special vertical handling
    const rotates = 'ー〜〜～()（）[]［］{}｛｝「」『』<>〈〉《》【】…―'
    const smallChars = 'っゃゅょぁぃぅぇぉッャュョァィゥェォ'
    const punctuations = '。、'

    return (
        <Group>
            {lines.map((line, lineIdx) => (
                <Group key={lineIdx} x={startX - lineIdx * (fontSize + columnSpacing)}>
                    {line.split('').map((char, charIdx) => {
                        let rotation = 0
                        let xOffset = 0
                        let yOffset = 0

                        if (rotates.includes(char)) {
                            rotation = 90
                            xOffset = fontSize
                        } else if (smallChars.includes(char)) {
                            xOffset = fontSize * 0.2
                            yOffset = -fontSize * 0.1
                        } else if (punctuations.includes(char)) {
                            xOffset = fontSize * 0.8
                            yOffset = -fontSize * 0.5
                        }

                        return (
                            <Text
                                key={charIdx}
                                text={char}
                                x={xOffset}
                                y={charIdx * (fontSize + charSpacing) + yOffset}
                                fontSize={fontSize}
                                fill={fontColor}
                                fontFamily={fontFamily}
                                align="center"
                                width={fontSize}
                                rotation={rotation}
                                fontStyle={fontWeight}
                            />
                        )
                    })}
                </Group>
            ))}
        </Group>
    )
}

export const MegaphoneText: React.FC<{
    text: string;
    fontSize: number;
    fontColor: string;
    fontFamily: string;
    fontWeight: string;
    width: number;
    height: number;
    narrowRatio: number;
    isVertical: boolean;
    lineHeight: number;
}> = ({ text, fontSize, fontColor, fontFamily, fontWeight, width, height, narrowRatio, isVertical, lineHeight }) => {
    const lines = text.split('\n').filter((_, i) => i < 20)
    const n = lines.length
    const ratio = narrowRatio || 0.3

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
                        currentY += charFontSize * 1.1
                        return { char, fontSize: charFontSize, y }
                    })

                    const blockHeight = currentY
                    const yOffsetTop = (height - blockHeight) / 2

                    return (
                        <Group key={lineIdx} x={startX + (lines.length - 1 - lineIdx) * (fontSize + columnGap)} y={yOffsetTop}>
                            {charData.map((data, charIdx) => {
                                const rotates = 'ー〜〜～()（）[]［］{}｛｝「」『』<>〈〉《》【】…―'
                                const smallChars = 'っゃゅょぁぃぅぇぉッャュョァィゥェォ'
                                const punctuations = '。、'
                                let charRotation = 0
                                let xCharOffset = (fontSize - data.fontSize) / 2
                                let yCharOffset = 0

                                if (rotates.includes(data.char)) {
                                    charRotation = 90
                                    xCharOffset += data.fontSize
                                } else if (smallChars.includes(data.char)) {
                                    xCharOffset += data.fontSize * 0.2
                                    yCharOffset = -data.fontSize * 0.1
                                } else if (punctuations.includes(data.char)) {
                                    xCharOffset += data.fontSize * 0.8
                                    yCharOffset = -data.fontSize * 0.5
                                }

                                return (
                                    <Text
                                        key={charIdx}
                                        text={data.char}
                                        x={xCharOffset}
                                        y={data.y + yCharOffset}
                                        fontSize={data.fontSize}
                                        fill={fontColor}
                                        fontFamily={fontFamily}
                                        fontStyle={fontWeight}
                                        rotation={charRotation}
                                        align="center"
                                        width={data.fontSize}
                                    />
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
                <Text
                    key={i}
                    text={data.line}
                    x={(width - data.lineW) / 2}
                    y={data.y}
                    width={data.lineW}
                    fontSize={data.fontSize}
                    fill={fontColor}
                    fontFamily={fontFamily}
                    fontStyle={fontWeight}
                    align="center"
                />
            ))}
        </Group>
    )
}
