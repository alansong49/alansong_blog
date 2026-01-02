import type { MusicItem } from '@/app/music/services/push-music'

const STORAGE_KEY = 'local-music-list'

export interface LocalMusicItem extends MusicItem {
	id: string // 本地唯一 ID
	fileData?: string // Base64 编码的文件数据（仅用于本地文件）
	fileType?: string // 文件 MIME 类型
	isLocal: true // 标记为本地音乐
}

/**
 * 获取本地保存的音乐列表
 */
export function getLocalMusicList(): LocalMusicItem[] {
	if (typeof window === 'undefined') return []
	
	try {
		const stored = localStorage.getItem(STORAGE_KEY)
		if (!stored) return []
		return JSON.parse(stored) as LocalMusicItem[]
	} catch (error) {
		console.error('Failed to load local music list:', error)
		return []
	}
}

/**
 * 保存音乐到本地存储
 */
export async function saveMusicToLocal(file: File, name: string): Promise<LocalMusicItem> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			try {
				const id = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
				const musicItem: LocalMusicItem = {
					id,
					name,
					url: URL.createObjectURL(file), // 使用 object URL 用于预览
					fileData: reader.result as string, // Base64 数据
					fileType: file.type,
					isLocal: true
				}
				
				const list = getLocalMusicList()
				list.push(musicItem)
				localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
				
				resolve(musicItem)
			} catch (error) {
				reject(error)
			}
		}
		reader.onerror = reject
		reader.readAsDataURL(file)
	})
}

/**
 * 从本地存储删除音乐
 */
export function removeLocalMusic(id: string): void {
	const list = getLocalMusicList()
	const music = list.find(m => m.id === id)
	
	// 如果是 object URL，需要释放它
	if (music && music.url.startsWith('blob:')) {
		URL.revokeObjectURL(music.url)
	}
	
	const updatedList = list.filter(m => m.id !== id)
	localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList))
}

/**
 * 清空本地音乐列表
 */
export function clearLocalMusicList(): void {
	const list = getLocalMusicList()
	// 释放所有 object URL
	list.forEach(music => {
		if (music.url.startsWith('blob:')) {
			URL.revokeObjectURL(music.url)
		}
	})
	localStorage.removeItem(STORAGE_KEY)
}

/**
 * 从 Base64 数据创建 Blob URL
 */
export function createBlobUrlFromBase64(fileData: string, fileType?: string): string | null {
	try {
		// fileData 格式: data:audio/mpeg;base64,...
		const base64Data = fileData.split(',')[1] || fileData
		const byteCharacters = atob(base64Data)
		const byteNumbers = new Array(byteCharacters.length)
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i)
		}
		const byteArray = new Uint8Array(byteNumbers)
		const blob = new Blob([byteArray], { type: fileType || 'audio/mpeg' })
		return URL.createObjectURL(blob)
	} catch (error) {
		console.error('Failed to create blob URL from Base64:', error)
		return null
	}
}

/**
 * 恢复本地音乐的 URL（如果 blob URL 失效，从 Base64 数据重新创建）
 */
export function restoreLocalMusicUrl(localMusic: LocalMusicItem): string {
	// 如果 URL 不是 blob URL，直接返回
	if (!localMusic.url.startsWith('blob:')) {
		return localMusic.url
	}

	// 如果有 Base64 数据，重新创建 blob URL
	if (localMusic.fileData) {
		const newUrl = createBlobUrlFromBase64(localMusic.fileData, localMusic.fileType)
		if (newUrl) {
			// 更新 localStorage 中的 URL
			const list = getLocalMusicList()
			const updatedList = list.map(m => 
				m.id === localMusic.id ? { ...m, url: newUrl } : m
			)
			localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList))
			return newUrl
		}
	}

	// 如果无法恢复，返回原 URL（可能会失败，但至少不会崩溃）
	return localMusic.url
}

/**
 * 将本地音乐转换为可用于上传的格式
 */
export async function convertLocalMusicToFile(localMusic: LocalMusicItem): Promise<File | null> {
	if (!localMusic.fileData) return null
	
	try {
		// 将 Base64 数据转换为 Blob
		// fileData 格式: data:audio/mpeg;base64,...
		const base64Data = localMusic.fileData.split(',')[1] || localMusic.fileData
		const byteCharacters = atob(base64Data)
		const byteNumbers = new Array(byteCharacters.length)
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i)
		}
		const byteArray = new Uint8Array(byteNumbers)
		const blob = new Blob([byteArray], { type: localMusic.fileType || 'audio/mpeg' })
		
		// 从 fileType 或 URL 推断文件扩展名
		const ext = localMusic.fileType?.split('/')[1] || 'mp3'
		const filename = `${localMusic.name}.${ext}`
		
		return new File([blob], filename, { type: localMusic.fileType || 'audio/mpeg' })
	} catch (error) {
		console.error('Failed to convert local music to file:', error)
		return null
	}
}

