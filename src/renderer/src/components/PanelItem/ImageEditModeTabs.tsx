import React from 'react'
import { Group, Rect, Text, Line, Circle } from 'react-konva'
import type { MangaLevel } from '../../utils/manga/renderManga'

/** コマ選択中に Shift で表示する画像編集タブ（移動/拡縮/回転＋画像処理ボタン群） */
export type ImageEditMode = 'move' | 'scale' | 'rotate'


export const ImageEditModeTabs: React.FC<{
    hasImage: boolean
    mode: ImageEditMode
    onChange: (mode: ImageEditMode) => void
    isGrayscale: boolean
    imageFlipX: boolean
    onToggleGrayscale: () => void
    onToggleFlipX: () => void
    onWand?: () => void
    imageProtrude?: boolean
    onToggleProtrude?: () => void
    isManga?: boolean
    mangaLevel?: MangaLevel
    mangaBusy?: boolean
    onSetManga?: (level: MangaLevel) => void
    novelaiActive: boolean
    onNovelAI: () => void
}> = ({
    hasImage,
    mode,
    onChange,
    isGrayscale,
    imageFlipX,
    onToggleGrayscale,
    onToggleFlipX,
    onWand,
    imageProtrude,
    onToggleProtrude,
    isManga,
    mangaLevel,
    mangaBusy,
    onSetManga,
    novelaiActive,
    onNovelAI
}) => {
    const tabs: Array<{ key: ImageEditMode; title: string }> = [
        { key: 'move', title: '移動' },
        { key: 'scale', title: '拡大縮小' },
        { key: 'rotate', title: '回転' }
    ]

    const showWand = hasImage && !!onWand
    const showProtrude = hasImage && !!onToggleProtrude
    const showManga = hasImage && !!onSetManga
    // ワンド（手動）→ はみ出し → 漫画化 → NovelAI の順に縦積み。各行 28px + 余白 4px = 32px。
    let stackY = 38
    const wandY = stackY
    if (showWand) stackY += 32
    const protrudeY = stackY
    if (showProtrude) stackY += 32
    const mangaY = stackY
    if (showManga) stackY += 32
    const novelaiY = hasImage ? stackY : 0

    return (
        <Group>
            {hasImage && <>
            <Rect
                x={0}
                y={0}
                width={170}
                height={34}
                cornerRadius={8}
                fill="rgba(24,24,27,0.95)"
                stroke="#3f3f46"
                strokeWidth={1}
                onMouseDown={(e) => { e.cancelBubble = true }}
                onMouseUp={(e) => { e.cancelBubble = true }}
                onClick={(e) => { e.cancelBubble = true }}
                onTap={(e) => { e.cancelBubble = true }}
            />
            {tabs.map((tab, i) => {
                const active = mode === tab.key
                return (
                    <Group
                        key={tab.key}
                        x={5 + i * 31}
                        y={4}
                        name={tab.title}
                        onMouseDown={(e) => { e.cancelBubble = true; onChange(tab.key) }}
                        onMouseUp={(e) => { e.cancelBubble = true }}
                        onClick={(e) => { e.cancelBubble = true; onChange(tab.key) }}
                        onTouchStart={(e) => { e.cancelBubble = true; onChange(tab.key) }}
                        onTap={(e) => { e.cancelBubble = true; onChange(tab.key) }}
                    >
                        <Rect
                            width={28}
                            height={26}
                            cornerRadius={6}
                            fill={active ? '#2563eb' : 'transparent'}
                            stroke={active ? '#3b82f6' : 'transparent'}
                            strokeWidth={1}
                        />
                        {tab.key === 'move' && (
                            <Group listening={false}>
                                <Line points={[8, 13, 20, 13]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                                <Line points={[10, 10, 8, 13, 10, 16]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                                <Line points={[18, 10, 20, 13, 18, 16]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                                <Line points={[14, 7, 14, 19]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                                <Line points={[11, 9, 14, 7, 17, 9]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                                <Line points={[11, 17, 14, 19, 17, 17]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                            </Group>
                        )}
                        {tab.key === 'scale' && (
                            <Group listening={false}>
                                <Rect x={8} y={8} width={12} height={12} fill="transparent" stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                                <Line points={[18, 10, 22, 6]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                                <Line points={[19, 6, 22, 6, 22, 9]} stroke={active ? '#ffffff' : '#a1a1aa'} strokeWidth={2} />
                            </Group>
                        )}
                        {tab.key === 'rotate' && (
                            <Group listening={false}>
                                <Text
                                    x={6}
                                    y={4}
                                    width={16}
                                    text="↻"
                                    align="center"
                                    fontSize={16}
                                    fontStyle="bold"
                                    fill={active ? '#ffffff' : '#a1a1aa'}
                                />
                            </Group>
                        )}
                    </Group>
                )
            })}
            <Line points={[99, 6, 99, 28]} stroke="#3f3f46" strokeWidth={1} listening={false} />
            <Group
                x={106}
                y={4}
                onMouseDown={(e) => { e.cancelBubble = true }}
                onMouseUp={(e) => { e.cancelBubble = true }}
                onClick={(e) => { e.cancelBubble = true; onToggleGrayscale() }}
                onTouchStart={(e) => { e.cancelBubble = true; onToggleGrayscale() }}
                onTap={(e) => { e.cancelBubble = true; onToggleGrayscale() }}
            >
                <Rect
                    width={28}
                    height={26}
                    cornerRadius={6}
                    fill={isGrayscale ? '#2563eb' : 'transparent'}
                    stroke={isGrayscale ? '#3b82f6' : 'transparent'}
                    strokeWidth={1}
                />
                <Circle x={14} y={13} radius={7} fill="transparent" stroke={isGrayscale ? '#ffffff' : '#a1a1aa'} strokeWidth={2} listening={false} />
                <Line points={[14, 6, 14, 20]} stroke={isGrayscale ? '#ffffff' : '#a1a1aa'} strokeWidth={2} listening={false} />
            </Group>
            <Group
                x={137}
                y={4}
                onMouseDown={(e) => { e.cancelBubble = true }}
                onMouseUp={(e) => { e.cancelBubble = true }}
                onClick={(e) => { e.cancelBubble = true; onToggleFlipX() }}
                onTouchStart={(e) => { e.cancelBubble = true; onToggleFlipX() }}
                onTap={(e) => { e.cancelBubble = true; onToggleFlipX() }}
            >
                <Rect
                    width={28}
                    height={26}
                    cornerRadius={6}
                    fill={imageFlipX ? '#2563eb' : 'transparent'}
                    stroke={imageFlipX ? '#3b82f6' : 'transparent'}
                    strokeWidth={1}
                />
                <Line points={[8, 13, 20, 13]} stroke={imageFlipX ? '#ffffff' : '#a1a1aa'} strokeWidth={2} listening={false} />
                <Line points={[10, 10, 8, 13, 10, 16]} stroke={imageFlipX ? '#ffffff' : '#a1a1aa'} strokeWidth={2} listening={false} />
                <Line points={[18, 10, 20, 13, 18, 16]} stroke={imageFlipX ? '#ffffff' : '#a1a1aa'} strokeWidth={2} listening={false} />
                <Line points={[14, 8, 14, 18]} stroke={imageFlipX ? '#ffffff' : '#a1a1aa'} strokeWidth={1.5} dash={[2, 2]} listening={false} />
            </Group>
            {showWand ? (
                <Group y={wandY}>
                    <Rect
                        x={0}
                        y={0}
                        width={170}
                        height={28}
                        cornerRadius={6}
                        fill="rgba(24,24,27,0.95)"
                        stroke="#3f3f46"
                        strokeWidth={1}
                        onMouseDown={(e) => {
                            e.cancelBubble = true
                        }}
                        onMouseUp={(e) => {
                            e.cancelBubble = true
                        }}
                        onClick={(e) => {
                            e.cancelBubble = true
                            onWand!()
                        }}
                        onTap={(e) => {
                            e.cancelBubble = true
                            onWand!()
                        }}
                    />
                    <Text
                        x={0}
                        y={7}
                        width={170}
                        align="center"
                        text="手動で背景消し（ワンド）"
                        fontSize={11}
                        fill="#e4e4e7"
                        listening={false}
                    />
                </Group>
            ) : null}
            {showProtrude ? (
                <Group y={protrudeY}>
                    <Rect
                        x={0}
                        y={0}
                        width={170}
                        height={28}
                        cornerRadius={6}
                        fill={imageProtrude ? 'rgba(37,99,235,0.95)' : 'rgba(24,24,27,0.95)'}
                        stroke={imageProtrude ? '#3b82f6' : '#3f3f46'}
                        strokeWidth={1}
                        onMouseDown={(e) => {
                            e.cancelBubble = true
                        }}
                        onMouseUp={(e) => {
                            e.cancelBubble = true
                        }}
                        onClick={(e) => {
                            e.cancelBubble = true
                            onToggleProtrude!()
                        }}
                        onTap={(e) => {
                            e.cancelBubble = true
                            onToggleProtrude!()
                        }}
                    />
                    <Text
                        x={0}
                        y={7}
                        width={170}
                        align="center"
                        text={imageProtrude ? 'コマからはみ出す：ON' : 'コマからはみ出す'}
                        fontSize={11}
                        fill={imageProtrude ? '#ffffff' : '#e4e4e7'}
                        listening={false}
                    />
                </Group>
            ) : null}
            {showManga ? (
                <Group y={mangaY}>
                    {/* 背板 */}
                    <Rect
                        x={0}
                        y={0}
                        width={170}
                        height={28}
                        cornerRadius={6}
                        fill="rgba(24,24,27,0.95)"
                        stroke="#3f3f46"
                        strokeWidth={1}
                        onMouseDown={(e) => { e.cancelBubble = true }}
                        onMouseUp={(e) => { e.cancelBubble = true }}
                        onClick={(e) => { e.cancelBubble = true }}
                        onTap={(e) => { e.cancelBubble = true }}
                    />
                    {mangaBusy ? (
                        <Text x={0} y={7} width={170} align="center" text="漫画化中…" fontSize={11} fill="#71717a" listening={false} />
                    ) : (
                        <>
                            {/* ラベル */}
                            <Text x={8} y={8} text="漫画" fontSize={11} fill="#a1a1aa" listening={false} />
                            {/* 弱 / 中 / 強 の 3 段 */}
                            {([
                                { key: 'weak' as MangaLevel, label: '弱' },
                                { key: 'mid' as MangaLevel, label: '中' },
                                { key: 'strong' as MangaLevel, label: '強' }
                            ]).map((seg, i) => {
                                const active = !!isManga && (mangaLevel ?? 'mid') === seg.key
                                const segW = 40
                                const x = 46 + i * (segW + 1)
                                return (
                                    <Group
                                        key={seg.key}
                                        x={x}
                                        y={3}
                                        onMouseDown={(e) => { e.cancelBubble = true }}
                                        onMouseUp={(e) => { e.cancelBubble = true }}
                                        onClick={(e) => { e.cancelBubble = true; onSetManga!(seg.key) }}
                                        onTouchStart={(e) => { e.cancelBubble = true }}
                                        onTap={(e) => { e.cancelBubble = true; onSetManga!(seg.key) }}
                                    >
                                        <Rect
                                            width={segW}
                                            height={22}
                                            cornerRadius={5}
                                            fill={active ? '#2563eb' : 'transparent'}
                                            stroke={active ? '#3b82f6' : '#52525b'}
                                            strokeWidth={1}
                                        />
                                        <Text
                                            width={segW}
                                            y={5}
                                            text={seg.label}
                                            align="center"
                                            fontSize={12}
                                            fontStyle={active ? 'bold' : 'normal'}
                                            fill={active ? '#ffffff' : '#d4d4d8'}
                                            listening={false}
                                        />
                                    </Group>
                                )
                            })}
                        </>
                    )}
                </Group>
            ) : null}
            </>}
            <Group y={novelaiY}>
                <Rect
                    x={0}
                    y={0}
                    width={170}
                    height={28}
                    cornerRadius={6}
                    fill={novelaiActive ? 'rgba(79,70,229,0.95)' : 'rgba(39,39,42,0.95)'}
                    stroke={novelaiActive ? '#818cf8' : '#3f3f46'}
                    strokeWidth={1}
                    onMouseDown={(e) => { e.cancelBubble = true }}
                    onMouseUp={(e) => { e.cancelBubble = true }}
                    onClick={(e) => {
                        e.cancelBubble = true
                        if (novelaiActive) onNovelAI()
                    }}
                    onTap={(e) => {
                        e.cancelBubble = true
                        if (novelaiActive) onNovelAI()
                    }}
                />
                <Text
                    x={0}
                    y={7}
                    width={170}
                    align="center"
                    text={novelaiActive ? 'NovelAI で画像生成' : 'NovelAI 未接続（設定から疎通確認）'}
                    fontSize={11}
                    fontStyle="bold"
                    fill={novelaiActive ? '#ffffff' : '#71717a'}
                    listening={false}
                />
            </Group>
        </Group>
    )
}
