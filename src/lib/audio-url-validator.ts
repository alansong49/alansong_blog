/**
 * 检查 URL 是否是有效的音频文件 URL
 */
export function isValidAudioUrl(url: string): boolean {
	if (!url || url.trim() === '') return false

	// blob URL 和 data URL 是有效的
	if (url.startsWith('blob:') || url.startsWith('data:')) {
		return true
	}

	try {
		const urlObj = new URL(url)
		
		// 检查是否是常见的音频文件扩展名
		const audioExtensions = ['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac', '.webm', '.opus']
		const pathname = urlObj.pathname.toLowerCase()
		const hasAudioExtension = audioExtensions.some(ext => pathname.endsWith(ext))
		
		if (hasAudioExtension) {
			return true
		}

		// 检查是否是直接的音频文件（没有查询参数或路径很短的可能是 API 端点）
		// 但排除明显的网页链接
		const hostname = urlObj.hostname.toLowerCase()
		const isWebPageLink = 
			hostname.includes('music.163.com') ||
			hostname.includes('youtube.com') ||
			hostname.includes('youtu.be') ||
			hostname.includes('bilibili.com') ||
			urlObj.pathname.includes('/song') ||
			urlObj.pathname.includes('/play') ||
			urlObj.pathname.includes('/video') ||
			urlObj.hash.includes('#/')

		if (isWebPageLink) {
			return false
		}

		// 如果 URL 看起来像直接的音频文件（没有明显的网页特征），允许尝试
		// 但会通过实际的加载来验证
		return true
	} catch {
		// 如果不是有效的 URL，返回 false
		return false
	}
}

/**
 * 获取 URL 验证错误消息
 */
export function getAudioUrlErrorMessage(url: string): string {
	if (!url || url.trim() === '') {
		return 'URL 不能为空'
	}

	try {
		const urlObj = new URL(url)
		const hostname = urlObj.hostname.toLowerCase()

		if (hostname.includes('music.163.com')) {
			return '不支持网易云音乐网页链接，请使用直接的音频文件 URL 或上传音频文件'
		}
		if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
			return '不支持 YouTube 链接，请使用直接的音频文件 URL 或上传音频文件'
		}
		if (hostname.includes('bilibili.com')) {
			return '不支持 Bilibili 链接，请使用直接的音频文件 URL 或上传音频文件'
		}
		if (urlObj.pathname.includes('/song') || urlObj.pathname.includes('/play') || urlObj.pathname.includes('/video')) {
			return '不支持音乐平台网页链接，请使用直接的音频文件 URL（如 .mp3, .m4a 等）或上传音频文件'
		}

		return 'URL 格式不正确，请使用直接的音频文件 URL（如 .mp3, .m4a 等）或上传音频文件'
	} catch {
		return 'URL 格式不正确'
	}
}

