import Konva from 'konva'
import { Panel, Bubble } from '../../store/useMangaStore'
import { getPRand, getRectPosByD, getRectDByAngle } from './bubbleUtils'

export const getPanelPoints = (panel: Panel) => {
    const { type, width, height, slant, offsetB, offsetC, offsetD } = panel
    const makeRegularPolygonPoints = (sides: number, radius: number, startAngle = -Math.PI / 2) => {
        const cx = width / 2
        const cy = height / 2
        const points: number[] = []
        for (let i = 0; i < sides; i++) {
            const a = startAngle + (i * Math.PI * 2) / sides
            points.push(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius)
        }
        return points
    }
    switch (type) {
        case 'slanted':
            return [slant, 0, width + slant, 0, width, height, 0, height]
        case 'trapezoid-h':
            return [slant, 0, width + offsetB, 0, width + offsetC, height, offsetD, height]
        case 'trapezoid-v':
            return [0, slant, width, offsetD, width, height + offsetC, 0, height + offsetB]
        case 'pentagon':
            // Top-pointing regular pentagon fit into current panel bounds
            // width extent factor: 2 * sin(72deg), height factor: 1 + sin(54deg)
            return makeRegularPolygonPoints(5, Math.min(width / 1.9022, height / 1.809), -Math.PI / 2)
        case 'hexagon':
            // Flat-top hexagon (top/bottom edges are horizontal)
            return makeRegularPolygonPoints(6, Math.min(width / 2, height / Math.sqrt(3)), 0)
        case 'circle':
            // Keep it a true circle even if width/height differ
            return makeRegularPolygonPoints(32, Math.min(width, height) / 2)
        case 'rect':
        default:
            return [0, 0, width, 0, width, height, 0, height]
    }
}

export const drawRectPath = (context: Konva.Context, bubble: Bubble, w: number, h: number) => {
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

export const drawJaggedPath = (context: Konva.Context, bubble: Bubble, w: number, h: number) => {
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
        const randomH = getPRand(i * 123.456)
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
                const rBase = 0.35
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

        const midAngle = p1.angle + step / 2
        const rInner = 0.35 - (0.1 * def)
        const cpX = w / 2 + Math.cos(midAngle) * w * rInner
        const cpY = h / 2 + Math.sin(midAngle) * h * rInner
        context.quadraticCurveTo(cpX, cpY, p2.x, p2.y)
    }
    context.closePath()
}

export const drawShoutPath = (context: Konva.Context, bubble: Bubble, w: number, h: number) => {
    const def = bubble.deformation ?? 1
    const tx = bubble.tailX || 0; const ty = bubble.tailY || 0
    const tcx = bubble.tailControlX || (tx / 2); const tcy = bubble.tailControlY || (ty / 2)
    const hasTail = Math.sqrt(tx * tx + ty * ty) > 10

    const cx = w / 2, cy = h / 2
    const P = 2 * (w + h)
    const dParams: { d: number, isPeak: boolean, peakLen: number }[] = []
    const cornerDists = [0, w, w + h, 2 * w + h]

    cornerDists.forEach((cd, i) => {
        const numSpikes = 3
        const spread = 8 * def
        for (let k = 0; k < numSpikes; k++) {
            const seed = i * 1000 + k
            const t = (k / (numSpikes - 1) - 0.5)
            const dBase = cd + t * spread
            dParams.push({ d: dBase - 1, isPeak: false, peakLen: 0 })
            dParams.push({ d: dBase, isPeak: true, peakLen: (8 + getPRand(seed) * 10) * def })
            dParams.push({ d: dBase + 1, isPeak: false, peakLen: 0 })
        }
        const nextCd = cornerDists[(i + 1) % 4]
        const midDist = (cd < nextCd) ? (cd + nextCd) / 2 : (cd + P + nextCd) / 2
        const sSeed = i * 5000
        const dBase = midDist + (getPRand(sSeed + 99) - 0.5) * 20
        dParams.push({ d: dBase - 2, isPeak: false, peakLen: 0 })
        dParams.push({ d: dBase, isPeak: true, peakLen: (3 + getPRand(sSeed) * 4) * def })
        dParams.push({ d: dBase + 2, isPeak: false, peakLen: 0 })
    })

    const tailAngle = Math.atan2(ty, tx)
    const tw = bubble.tailWidth || 20
    const angWidth = tw / 150
    const sAng = (tailAngle - angWidth + Math.PI * 2) % (Math.PI * 2)
    const eAng = (tailAngle + angWidth + Math.PI * 2) % (Math.PI * 2)

    if (hasTail) {
        dParams.push({ d: getRectDByAngle(sAng, w, h), isPeak: false, peakLen: 0 })
        dParams.push({ d: getRectDByAngle(eAng, w, h), isPeak: false, peakLen: 0 })
        dParams.sort((a, b) => a.d - b.d)
    }

    const finalPoints = dParams.map(p => {
        const b = getRectPosByD(p.d, w, h)
        if (p.isPeak) {
            const angle = Math.atan2(b.y - cy, b.x - cx)
            return { x: b.x + Math.cos(angle) * p.peakLen, y: b.y + Math.sin(angle) * p.peakLen, isPeak: true }
        }
        return { x: b.x, y: b.y, isPeak: false }
    })

    let tailInjected = false
    let startIdx = 0
    for (let i = 0; i < finalPoints.length; i++) {
        const ang = (Math.atan2(finalPoints[i].y - cy, finalPoints[i].x - cx) + Math.PI * 2) % (Math.PI * 2)
        if (!(sAng < eAng ? (ang >= sAng && ang <= eAng) : (ang >= sAng || ang <= eAng))) { startIdx = i; break }
    }

    context.beginPath()
    context.moveTo(finalPoints[startIdx].x, finalPoints[startIdx].y)

    for (let i = 0; i < finalPoints.length; i++) {
        const idx = (startIdx + i) % finalPoints.length
        const nextIdx = (startIdx + i + 1) % finalPoints.length
        const p1 = finalPoints[idx], p2 = finalPoints[nextIdx]
        const ang2 = (Math.atan2(p2.y - cy, p2.x - cx) + Math.PI * 2) % (Math.PI * 2)
        const isInGap = sAng < eAng ? (ang2 >= sAng && ang2 <= eAng) : (ang2 >= sAng || ang2 <= eAng)

        if (hasTail && isInGap) {
            if (!tailInjected) {
                const tipX = cx + tx; const tipY = cy + ty
                const ctrlX = cx + tcx; const ctrlY = cy + tcy
                const pL = getRectPosByD(getRectDByAngle(sAng, w, h), w, h)
                const pR = getRectPosByD(getRectDByAngle(eAng, w, h), w, h)
                context.lineTo(pL.x, pL.y)
                context.quadraticCurveTo(pL.x + (ctrlX - pL.x) * 0.4, pL.y + (ctrlY - pL.y) * 0.4, tipX, tipY)
                context.quadraticCurveTo(pR.x + (ctrlX - pR.x) * 0.4, pR.y + (ctrlY - pR.y) * 0.4, pR.x, pR.y)
                tailInjected = true
            }
            continue
        }
        if (p1.isPeak || p2.isPeak) context.lineTo(p2.x, p2.y)
        else {
            const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2
            const dx = midX - cx, dy = midY - cy
            const dist = Math.sqrt(dx * dx + dy * dy)
            const pull = (3 + getPRand(idx * 77) * 3) * def
            context.quadraticCurveTo(midX - (dx/(dist||1))*pull, midY - (dy/(dist||1))*pull, p2.x, p2.y)
        }
    }
    context.closePath()
}

export const drawSquareJaggedPath = (context: Konva.Context, bubble: Bubble, w: number, h: number) => {
    const spikeCount = bubble.spikeCount || 36
    const def = bubble.deformation ?? 1
    const tx = bubble.tailX || 0; const ty = bubble.tailY || 0
    const tcx = bubble.tailControlX || (tx / 2); const tcy = bubble.tailControlY || (ty / 2)
    const hasTail = Math.sqrt(tx * tx + ty * ty) > 10

    const corners = [{x:0,y:0}, {x:w,y:0}, {x:w,y:h}, {x:0,y:h}]
    const cornerDists = [0, w, w + h, 2 * w + h]
    const dPoints: {d:number, x:number, y:number}[] = []
    const pointsPerSide = Math.floor(spikeCount / 4)

    for (let i = 0; i < 4; i++) {
        const c1 = corners[i], c2 = corners[(i + 1) % 4], baseD = cornerDists[i]
        const cSeed = i * 200
        dPoints.push({ d: baseD, x: c1.x + (getPRand(cSeed)-0.5)*30*def, y: c1.y + (getPRand(cSeed+1)-0.5)*30*def })
        for (let j = 1; j < pointsPerSide; j++) {
            const t = j / pointsPerSide
            const tc = t < 0.5 ? 0.5 * Math.pow(2 * t, 0.8) : 1 - 0.5 * Math.pow(2 * (1 - t), 0.8)
            const x = c1.x + (c2.x - c1.x) * tc, y = c1.y + (c2.y - c1.y) * tc
            const jw = 0.3 + 0.7 * Math.pow(1 - (Math.min(t, 1 - t) * 2), 2)
            const sSeed = i * 200 + j, jv = (getPRand(sSeed) * 20 + 5) * def * jw
            let pJX = 0, pJY = 0
            if (i === 0 || i === 2) pJY = (getPRand(sSeed + 1) - 0.5) * jv
            else pJX = (getPRand(sSeed + 1) - 0.5) * jv
            dPoints.push({ d: baseD + (c2.x === c1.x ? Math.abs(y - c1.y) : Math.abs(x - c1.x)), x: x + pJX, y: y + pJY })
        }
    }

    const tailAngle = (Math.atan2(ty, tx) + Math.PI * 2) % (Math.PI * 2)
    const tw = bubble.tailWidth || 20
    const angWidth = tw / 150
    const sAng = (tailAngle - angWidth + Math.PI * 2) % (Math.PI * 2)
    const eAng = (tailAngle + angWidth + Math.PI * 2) % (Math.PI * 2)

    if (hasTail) {
        const dL = getRectDByAngle(sAng, w, h), dR = getRectDByAngle(eAng, w, h)
        const pL = getRectPosByD(dL, w, h), pR = getRectPosByD(dR, w, h)
        dPoints.push({ d: dL, x: pL.x, y: pL.y }); dPoints.push({ d: dR, x: pR.x, y: pR.y })
    }
    dPoints.sort((a, b) => a.d - b.d)
    const finalPoints = dPoints.filter((p, i, arr) => i === 0 || Math.abs(p.d - arr[i-1].d) > 0.1)

    let tailInjected = false, startIdx = 0
    for (let i = 0; i < finalPoints.length; i++) {
        const ang = (Math.atan2(finalPoints[i].y - h/2, finalPoints[i].x - w/2) + Math.PI * 2) % (Math.PI * 2)
        if (!(sAng < eAng ? (ang >= sAng && ang <= eAng) : (ang >= sAng || ang <= eAng))) { startIdx = i; break }
    }

    context.beginPath()
    context.moveTo(finalPoints[startIdx].x, finalPoints[startIdx].y)
    for (let i = 0; i < finalPoints.length; i++) {
        const p1 = finalPoints[(startIdx + i) % finalPoints.length], p2 = finalPoints[(startIdx + i + 1) % finalPoints.length]
        const ang2 = (Math.atan2(p2.y - h/2, p2.x - w/2) + Math.PI * 2) % (Math.PI * 2)
        if (hasTail && (sAng < eAng ? (ang2 >= sAng && ang2 <= eAng) : (ang2 >= sAng || ang2 <= eAng))) {
            if (!tailInjected) {
                const tipX = w/2 + tx, tipY = h/2 + ty, ctrlX = w/2 + tcx, ctrlY = h/2 + tcy
                const pL = getRectPosByD(getRectDByAngle(sAng, w, h), w, h), pR = getRectPosByD(getRectDByAngle(eAng, w, h), w, h)
                context.lineTo(pL.x, pL.y)
                context.quadraticCurveTo(pL.x + (ctrlX - pL.x) * 0.4, pL.y + (ctrlY - pL.y) * 0.4, tipX, tipY)
                context.quadraticCurveTo(pR.x + (ctrlX - pR.x) * 0.4, pR.y + (ctrlY - pR.y) * 0.4, pR.x, pR.y)
                tailInjected = true
            }
            continue
        }
        const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2, dx = midX - w/2, dy = midY - h/2, dist = Math.sqrt(dx*dx + dy*dy)
        const pull = (10 + getPRand((startIdx + i) * 500) * 15) * def
        context.quadraticCurveTo(midX - (dx/(dist||1)) * pull, midY - (dy/(dist||1)) * pull, p2.x, p2.y)
    }
    context.closePath()
}

export const drawRoundedPath = (context: Konva.Context, bubble: Bubble, w: number, h: number) => {
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

export const drawFlashPath = (context: Konva.Context, bubble: Bubble, w: number, h: number) => {
    const lineCount = Math.max(100, (bubble.spikeCount || 36) * 10)
    const def = bubble.deformation ?? 1
    context.beginPath()
    for (let i = 0; i < lineCount; i++) {
        const angle = (i / lineCount) * Math.PI * 2
        const rand = getPRand(i * 98.765)
        const lengthMod = bubble.flashLength ?? 1
        const rInner = 0.35 + (0.05 * rand * def)
        const gap = (0.1 + 0.15 * rand * def) * lengthMod
        const rOuter = rInner + gap
        context.moveTo(w/2 + Math.cos(angle)*w*rInner, h/2 + Math.sin(angle)*h*rInner)
        context.lineTo(w/2 + Math.cos(angle)*w*rOuter, h/2 + Math.sin(angle)*h*rOuter)
    }
}

export const drawJitteryCircle = (context: Konva.Context, x: number, y: number, radius: number, def: number) => {
    const points = 36
    const jitterDef = Math.max(0.5, def)
    context.beginPath()
    for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2
        const jitter = (Math.sin(angle * 3) * 0.04 + Math.cos(angle * 5) * 0.02 + Math.sin(angle * 12) * 0.01) * jitterDef
        const r = radius * (1 + jitter)
        const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r
        if (i === 0) context.moveTo(px, py)
        else context.lineTo(px, py)
    }
    context.closePath()
}

export const drawMegaphonePath = (context: Konva.Context, bubble: Bubble, w: number, h: number, shape?: Konva.Shape) => {
    const ratio = bubble.narrowRatio ?? 0.3
    const topHalfW = w / 2, bottomHalfW = w * ratio / 2, cx = w / 2
    context.beginPath()
    context.moveTo(cx - topHalfW, 0); context.lineTo(cx + topHalfW, 0); context.lineTo(cx + bottomHalfW, h); context.lineTo(cx - bottomHalfW, h)
    context.closePath()
    if (shape) {
        const sw = shape.strokeWidth()
        if (sw > 0) {
            context.save()
            context.setAttr('lineWidth', sw); context.setAttr('strokeStyle', shape.stroke())
            context.beginPath(); context.moveTo(cx - topHalfW, 0); context.lineTo(cx - bottomHalfW, h); context.stroke()
            context.beginPath(); context.moveTo(cx + topHalfW, 0); context.lineTo(cx + bottomHalfW, h); context.stroke()
            context.restore()
        }
    } else {
        context.beginPath(); context.moveTo(cx - topHalfW, 0); context.lineTo(cx - bottomHalfW, h); context.stroke()
        context.beginPath(); context.moveTo(cx + topHalfW, 0); context.lineTo(cx + bottomHalfW, h); context.stroke()
    }
    context.beginPath()
    context.moveTo(cx - topHalfW, 0); context.lineTo(cx + topHalfW, 0); context.lineTo(cx + bottomHalfW, h); context.lineTo(cx - bottomHalfW, h)
    context.closePath()
}

export const drawDoubleRectPath = (context: Konva.Context, bubble: Bubble, w: number, h: number, shape?: Konva.Shape) => {
    const cornerRadius = 8
    const baseBorderWidth = bubble.borderWidth ?? 2
    // Use base border width for gap calculation so it stays consistent across passes
    const gap = Math.max(6, baseBorderWidth * 3)

    const drawRect = (ctx: Konva.Context, width: number, height: number, offset: number) => {
        const r = Math.max(0, cornerRadius - offset)
        ctx.beginPath()
        ctx.moveTo(r + offset, offset)
        ctx.lineTo(width - r - offset, offset)
        ctx.quadraticCurveTo(width - offset, offset, width - offset, r + offset)
        ctx.lineTo(width - offset, height - r - offset)
        ctx.quadraticCurveTo(width - offset, height - offset, width - r - offset, height - offset)
        ctx.lineTo(r + offset, height - offset)
        ctx.quadraticCurveTo(offset, height - offset, offset, height - r - offset)
        ctx.lineTo(offset, r + offset)
        ctx.quadraticCurveTo(offset, offset, r + offset, offset)
        ctx.closePath()
    }

    // Determine current pass state
    const isMask = shape && shape.fill() === 'black' && shape.opacity() === 1;
    const isFillsPass = shape && !!shape.fill() && !isMask;

    // 1. Fill and Stroke the outer rectangle
    drawRect(context, w, h, 0)
    if (shape) {
        context.fillStrokeShape(shape)
    } else {
        context.fill()
        context.stroke()
    }

    // 2. Stroke the inner rectangle manually
    // We draw it during the fills pass (to stay on top of the fill)
    // or when there's no pass (direct render).
    // In clustering, Layer 2 (strokes) is behind Layer 3 (fills), 
    // so we MUST draw the inner line in Layer 3 to be seen.
    if (baseBorderWidth > 0 && !isMask) {
        context.save()
        // Always use original bubble border properties for the inner line 
        // to avoid doubled width during the strokes pass.
        context.setAttr('strokeStyle', bubble.borderColor || 'black')
        context.setAttr('lineWidth', baseBorderWidth)
        
        drawRect(context, w, h, gap)
        context.stroke()
        context.restore()
    }
}
