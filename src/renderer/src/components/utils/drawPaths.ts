import { Panel, Bubble } from '../../store/useMangaStore'

export const getPanelPoints = (panel: Panel) => {
    const { type, width, height, slant, offsetB, offsetC, offsetD } = panel
    switch (type) {
        case 'slanted':
            return [slant, 0, width + slant, 0, width, height, 0, height]
        case 'trapezoid-h':
            return [slant, 0, width + offsetB, 0, width + offsetC, height, offsetD, height]
        case 'trapezoid-v':
            return [0, slant, width, offsetD, width, height + offsetC, 0, height + offsetB]
        case 'rect':
        default:
            return [0, 0, width, 0, width, height, 0, height]
    }
}

export const drawRectPath = (context: any, bubble: Bubble, w: number, h: number) => {
    const tx = bubble.tailX || 0; const ty = bubble.tailY || 0
    const tcx = bubble.tailControlX || (tx / 2); const tcy = bubble.tailControlY || (ty / 2)
    const tw = bubble.tailWidth || 20
    const tipX = w / 2 + tx; const tipY = h / 2 + ty
    const cX = w / 2 + tcx; const cY = h / 2 + tcy
    const hasTail = Math.sqrt(tx * tx + ty * ty) > 10
    const cornerRadius = 4
    context.beginPath()
    context.moveTo(cornerRadius, 0)
    context.lineTo(w - cornerRadius, 0)
    context.quadraticCurveTo(w, 0, w, cornerRadius)
    if (hasTail && Math.abs(tx) > Math.abs(ty) && tx > 0) {
        const yL = h / 2 - tw / 2; const yR = h / 2 + tw / 2
        const scX = Math.max(w, cX)
        context.lineTo(w, yL)
        context.quadraticCurveTo(w + (scX - w) * 0.4, yL + (cY - yL) * 0.4, tipX, tipY)
        context.quadraticCurveTo(w + (scX - w) * 0.4, yR + (cY - yR) * 0.4, w, yR)
    }
    context.lineTo(w, h - cornerRadius)
    context.quadraticCurveTo(w, h, w - cornerRadius, h)
    if (hasTail && Math.abs(ty) > Math.abs(tx) && ty > 0) {
        const xL = w / 2 + tw / 2; const xR = w / 2 - tw / 2
        const scY = Math.max(h, cY)
        context.lineTo(xL, h)
        context.quadraticCurveTo(xL + (cX - xL) * 0.4, h + (scY - h) * 0.4, tipX, tipY)
        context.quadraticCurveTo(xR + (cX - xR) * 0.4, h + (scY - h) * 0.4, xR, h)
    }
    context.lineTo(cornerRadius, h)
    context.quadraticCurveTo(0, h, 0, h - cornerRadius)
    if (hasTail && Math.abs(tx) > Math.abs(ty) && tx < 0) {
        const yL = h / 2 + tw / 2; const yR = h / 2 - tw / 2
        const scX = Math.min(0, cX)
        context.lineTo(0, yL)
        context.quadraticCurveTo(scX * 0.4, yL + (cY - yL) * 0.4, tipX, tipY)
        context.quadraticCurveTo(scX * 0.4, yR + (cY - yR) * 0.4, 0, yR)
    }
    context.lineTo(0, cornerRadius)
    context.quadraticCurveTo(0, 0, cornerRadius, 0)
    context.closePath()
}

export const drawJaggedPath = (context: any, bubble: Bubble, w: number, h: number) => {
    const spikeCount = bubble.spikeCount || 36
    const def = bubble.deformation ?? 1
    const tx = bubble.tailX || 0; const ty = bubble.tailY || 0
    const tcx = bubble.tailControlX || (tx / 2); const tcy = bubble.tailControlY || (ty / 2)
    const tw = bubble.tailWidth || 20
    const hasTail = Math.sqrt(tx * tx + ty * ty) > 10
    const tailAngle = Math.atan2(ty, tx)
    const angOffset = (tw / 150)
    const sAng = (tailAngle - angOffset + Math.PI * 2) % (Math.PI * 2)
    const eAng = (tailAngle + angOffset + Math.PI * 2) % (Math.PI * 2)
    let tailInjected = false

    context.beginPath()

    const step = (Math.PI * 2) / spikeCount
    const getPeak = (i: number) => {
        const angle = i * step
        const seed = Math.sin(i * 123.456) * 10000
        const randomH = (seed - Math.floor(seed))
        const rOuter = 0.5 + (0.05 + randomH * 0.2) * def
        return {
            x: w / 2 + Math.cos(angle) * w * rOuter,
            y: h / 2 + Math.sin(angle) * h * rOuter,
            angle
        }
    }

    let firstMove = true
    for (let i = 0; i < spikeCount; i++) {
        const p1 = getPeak(i)
        const p2 = getPeak(i + 1)
        const normAngle = p1.angle % (Math.PI * 2)
        const isInGap = sAng < eAng ? (normAngle >= sAng && normAngle <= eAng) : (normAngle >= sAng || normAngle <= eAng)

        if (hasTail && isInGap) {
            if (!tailInjected) {
                const tipX = w / 2 + tx; const tipY = h / 2 + ty
                let ctrlX = w / 2 + tcx; let ctrlY = h / 2 + tcy
                const rBase = 0.35 // Base radius for tail connection
                const xL = w / 2 + Math.cos(sAng) * w * rBase; const yL = h / 2 + Math.sin(sAng) * h * rBase
                const xR = w / 2 + Math.cos(eAng) * w * rBase; const yR = h / 2 + Math.sin(eAng) * h * rBase
                const midX = (xL + xR) / 2; const midY = (yL + yR) / 2
                const nx = (tipX - midX) / Math.sqrt((tipX - midX) ** 2 + (tipY - midY) ** 2 || 1)
                const ny = (tipY - midY) / Math.sqrt((tipX - midX) ** 2 + (tipY - midY) ** 2 || 1)
                if ((ctrlX - midX) * nx + (ctrlY - midY) * ny < 0) {
                    ctrlX = midX + nx * 5; ctrlY = midY + ny * 5
                }
                context.lineTo(xL, yL)
                context.quadraticCurveTo(xL + (ctrlX - xL) * 0.4, yL + (ctrlY - yL) * 0.4, tipX, tipY)
                context.quadraticCurveTo(xR + (ctrlX - xR) * 0.4, yR + (ctrlY - yR) * 0.4, xR, yR)
                tailInjected = true
            }
            continue
        }

        if (firstMove) {
            context.moveTo(p1.x, p1.y)
            firstMove = false
        }

        // Control point for the inward-bowing parabola
        const midAngle = p1.angle + step / 2
        const rInner = 0.35 - (0.1 * def) // Pull it inward
        const cpX = w / 2 + Math.cos(midAngle) * w * rInner
        const cpY = h / 2 + Math.sin(midAngle) * h * rInner

        context.quadraticCurveTo(cpX, cpY, p2.x, p2.y)
    }
    context.closePath()
}

export const drawRoundedPath = (context: any, bubble: Bubble, w: number, h: number) => {
    const points = 72
    const def = bubble.deformation ?? 1
    const tx = bubble.tailX || 0; const ty = bubble.tailY || 0
    const tcx = bubble.tailControlX || (tx / 2); const tcy = bubble.tailControlY || (ty / 2)
    const tw = bubble.tailWidth || 20
    const hasTail = Math.sqrt(tx * tx + ty * ty) > 10 && bubble.tailType !== 'thought'
    const tailAngle = Math.atan2(ty, tx)
    const angOffset = (tw / 250)
    const sAng = (tailAngle - angOffset + Math.PI * 2) % (Math.PI * 2)
    const eAng = (tailAngle + angOffset + Math.PI * 2) % (Math.PI * 2)
    let tailInjected = false
    context.beginPath()
    for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2
        const normAngle = angle % (Math.PI * 2)
        const isInGap = sAng < eAng ? (normAngle >= sAng && normAngle <= eAng) : (normAngle >= sAng || normAngle <= eAng)
        if (hasTail && isInGap) {
            if (!tailInjected) {
                const tipX = w / 2 + tx; const tipY = h / 2 + ty
                let ctrlX = w / 2 + tcx; let ctrlY = h / 2 + tcy
                const getR = (a: number) => 0.5 - (0.08 * Math.max(1, def)) + (Math.sin(a * 3) * 0.02) * def
                const xL = w / 2 + Math.cos(sAng) * w * getR(sAng); const yL = h / 2 + Math.sin(sAng) * h * getR(sAng)
                const xR = w / 2 + Math.cos(eAng) * w * getR(eAng); const yR = h / 2 + Math.sin(eAng) * h * getR(eAng)
                const midX = (xL + xR) / 2; const midY = (yL + yR) / 2
                const nx = (tipX - midX) / Math.sqrt((tipX - midX) ** 2 + (tipY - midY) ** 2)
                const ny = (tipY - midY) / Math.sqrt((tipX - midX) ** 2 + (tipY - midY) ** 2)
                if ((ctrlX - midX) * nx + (ctrlY - midY) * ny < 0) {
                    ctrlX = midX + nx * 5; ctrlY = midY + ny * 5
                }
                const flareF = tw * 0.25
                const sXL = xL + (ctrlX - xL) * 0.4 - Math.sin(sAng) * flareF * (tx > 0 ? 1 : -1)
                const sYL = yL + (ctrlY - yL) * 0.4 + Math.cos(sAng) * flareF * (ty > 0 ? 1 : -1)
                const sXR = xR + (ctrlX - xR) * 0.4 + Math.sin(eAng) * flareF * (tx > 0 ? -1 : 1)
                const sYR = yR + (ctrlY - yR) * 0.4 - Math.cos(eAng) * flareF * (ty > 0 ? -1 : 1)
                context.lineTo(xL, yL)
                context.quadraticCurveTo(sXL, sYL, tipX, tipY)
                context.quadraticCurveTo(sXR, sYR, xR, yR)
                tailInjected = true
            }
            continue
        }
        const jitter = (Math.sin(angle * 3) * 0.02 + Math.sin(angle * 7) * 0.01 + Math.cos(angle * 5) * 0.015) * def
        const r = 0.5 - (0.08 * Math.max(1, def)) + jitter
        const x = w / 2 + Math.cos(angle) * w * r; const y = h / 2 + Math.sin(angle) * h * r
        if (i === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
    }
    context.closePath()
}
export const drawFlashPath = (context: any, bubble: Bubble, w: number, h: number) => {
    const lineCount = Math.max(100, (bubble.spikeCount || 36) * 10)
    const def = bubble.deformation ?? 1

    context.beginPath()
    for (let i = 0; i < lineCount; i++) {
        const angle = (i / lineCount) * Math.PI * 2

        // Random lengths for the flash effect
        const seed = Math.sin(i * 98.765) * 10000
        const rand = (seed - Math.floor(seed))

        // Flash lines start from an inner ellipse and go outwards
        // We use flashLength to control the overall length
        const lengthMod = bubble.flashLength ?? 1
        const rInner = 0.35 + (0.05 * rand * def)
        const gap = (0.1 + 0.15 * rand * def) * lengthMod
        const rOuter = rInner + gap

        const x1 = w / 2 + Math.cos(angle) * w * rInner
        const y1 = h / 2 + Math.sin(angle) * h * rInner
        const x2 = w / 2 + Math.cos(angle) * w * rOuter
        const y2 = h / 2 + Math.sin(angle) * h * rOuter

        context.moveTo(x1, y1)
        context.lineTo(x2, y2)
    }
}
export const drawJitteryCircle = (context: any, x: number, y: number, radius: number, def: number) => {
    const points = 36
    const jitterDef = Math.max(0.5, def)
    context.beginPath()
    for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2
        // Organic fluctuation
        const jitter = (Math.sin(angle * 3) * 0.04 + Math.cos(angle * 5) * 0.02 + Math.sin(angle * 12) * 0.01) * jitterDef
        const r = radius * (1 + jitter)
        const px = x + Math.cos(angle) * r
        const py = y + Math.sin(angle) * r
        if (i === 0) context.moveTo(px, py)
        else context.lineTo(px, py)
    }
    context.closePath()
}
