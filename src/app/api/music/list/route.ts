import { NextResponse } from 'next/server'
import musicList from '@/app/music/list.json'

export async function GET() {
	try {
		return NextResponse.json(musicList)
	} catch (error) {
		console.error('Failed to load music list:', error)
		return NextResponse.json({ error: 'Failed to load music list' }, { status: 500 })
	}
}

