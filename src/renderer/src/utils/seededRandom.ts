/**
 * エフェクトの点／線を「固定生成」するための決定的擬似乱数。
 * 同じシードなら常に同じ値を返すため、再描画してもちらつかない。
 */

/** 文字列から決定的なシード値を作る（文字コードの総和） */
export function hashStringSeed(s: string): number {
    return s.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

/** sin ベースの決定的擬似乱数（0..1） */
export function sinRandom(s: number): number {
    const x = Math.sin(s) * 10000
    return x - Math.floor(x)
}
