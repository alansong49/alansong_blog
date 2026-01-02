import clsx, { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export function thousandsSeparator(n: string | number | any, sign: string = ',') {
	if (typeof n === 'string' || typeof n === 'number') {
		n = String(n)
		const reg = /\B(?=(\d{3})+($|\.))/g

		if (n.includes('.')) {
			const nArr = n.split('.')
			nArr[0] = nArr[0].replace(reg, `$&${sign}`)

			return nArr.join('.')
		}

		return n.replace(reg, `$&${sign}`)
	} else return 0
}

export function getFileExt(filename: string): string {
	const lower = filename.toLowerCase()
	if (lower.endsWith('.jpg')) return '.jpg'
	if (lower.endsWith('.jpeg')) return '.jpeg'
	if (lower.endsWith('.webp')) return '.webp'
	if (lower.endsWith('.png')) return '.png'
	if (lower.endsWith('.svg')) return '.svg'
	if (lower.endsWith('.mp3')) return '.mp3'
	if (lower.endsWith('.m4a')) return '.m4a'
	if (lower.endsWith('.wav')) return '.wav'
	if (lower.endsWith('.ogg')) return '.ogg'
	if (lower.endsWith('.flac')) return '.flac'
	if (lower.endsWith('.aac')) return '.aac'
	return '.png'
}

export function rand(a: number, b: number) {
	return a + Math.random() * (b - a)
}
