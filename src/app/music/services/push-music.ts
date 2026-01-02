import { toBase64Utf8, getRef, createTree, createCommit, updateRef, createBlob, readTextFileFromRepo, type TreeItem } from '@/lib/github-client'
import { fileToBase64NoPrefix, hashFileSHA256 } from '@/lib/file-utils'
import { getAuthToken } from '@/lib/auth'
import { GITHUB_CONFIG } from '@/consts'
import { getFileExt } from '@/lib/utils'
import { toast } from 'sonner'

export interface MusicItem {
	name: string
	url: string
}

export type MusicFileItem = {
	file: File
	hash?: string
}

export type PushMusicParams = {
	musicList: MusicItem[]
	musicFileItems?: Map<string, MusicFileItem>
}

export async function pushMusic(params: PushMusicParams): Promise<void> {
	const { musicList, musicFileItems } = params

	const token = await getAuthToken()

	toast.info('正在获取分支信息...')
	const refData = await getRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`)
	const latestCommitSha = refData.sha

	const commitMessage = `更新音乐列表`

	toast.info('正在准备文件...')

	const treeItems: TreeItem[] = []
	const uploadedHashes = new Set<string>()
	let updatedMusicList = [...musicList]

	// 处理音乐文件上传
	if (musicFileItems && musicFileItems.size > 0) {
		toast.info('正在上传音乐文件...')
		for (const [url, musicFileItem] of musicFileItems.entries()) {
			if (musicFileItem.file) {
				const hash = musicFileItem.hash || (await hashFileSHA256(musicFileItem.file))
				const ext = getFileExt(musicFileItem.file.name)
				const filename = `${hash}${ext}`
				const publicPath = `/music/${filename}`

				if (!uploadedHashes.has(hash)) {
					const path = `public/music/${filename}`
					const contentBase64 = await fileToBase64NoPrefix(musicFileItem.file)
					const blobData = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, contentBase64, 'base64')
					treeItems.push({
						path,
						mode: '100644',
						type: 'blob',
						sha: blobData.sha
					})
					uploadedHashes.add(hash)
				}

				// 更新音乐列表中的 URL
				updatedMusicList = updatedMusicList.map(m => (m.url === url ? { ...m, url: publicPath } : m))
			}
		}
	}

	// 读取之前的 list.json，找出不再使用的音乐文件
	toast.info('正在检查需要删除的文件...')
	const previousListJson = await readTextFileFromRepo(
		token,
		GITHUB_CONFIG.OWNER,
		GITHUB_CONFIG.REPO,
		'src/app/music/list.json',
		GITHUB_CONFIG.BRANCH
	)

	if (previousListJson) {
		try {
			const previousMusicList: MusicItem[] = JSON.parse(previousListJson)
			const previousUrls = new Set<string>()
			const currentUrls = new Set<string>()

			for (const music of previousMusicList) {
				if (music.url.startsWith('/music/')) {
					previousUrls.add(music.url)
				}
			}

			for (const music of updatedMusicList) {
				if (music.url.startsWith('/music/')) {
					currentUrls.add(music.url)
				}
			}

			// 找出不再使用的音乐文件
			for (const url of previousUrls) {
				if (!currentUrls.has(url)) {
					// 这是一个本地音乐文件，需要删除
					const filename = url.replace('/music/', '')
					const path = `public/music/${filename}`
					treeItems.push({
						path,
						mode: '100644',
						type: 'blob',
						sha: null
					})
				}
			}
		} catch (error) {
			console.error('Failed to parse previous list.json:', error)
		}
	}

	// 创建音乐列表的 blob
	const musicJson = JSON.stringify(updatedMusicList, null, '\t')
	const musicBlob = await createBlob(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, toBase64Utf8(musicJson), 'base64')
	treeItems.push({
		path: 'src/app/music/list.json',
		mode: '100644',
		type: 'blob',
		sha: musicBlob.sha
	})

	// 创建文件树
	toast.info('正在创建文件树...')
	const treeData = await createTree(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, treeItems, latestCommitSha)

	// 创建提交
	toast.info('正在创建提交...')
	const commitData = await createCommit(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, commitMessage, treeData.sha, [latestCommitSha])

	// 更新分支引用
	toast.info('正在更新分支...')
	await updateRef(token, GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, `heads/${GITHUB_CONFIG.BRANCH}`, commitData.sha)

	toast.success('发布成功！')
}

