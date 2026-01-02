'use client'

import { useState, useRef, useEffect } from 'react'
import { DialogModal } from '@/components/dialog-modal'
import { motion } from 'motion/react'
import { Plus, X, Music, Check, Upload, Cloud } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/hooks/use-auth'
import { pushMusic, type MusicItem, type MusicFileItem } from '@/app/music/services/push-music'
import { hashFileSHA256 } from '@/lib/file-utils'
import initialMusicList from '@/app/music/list.json'
import {
	getLocalMusicList,
	saveMusicToLocal,
	removeLocalMusic,
	convertLocalMusicToFile,
	type LocalMusicItem
} from '@/lib/local-music-storage'

interface MusicSelectDialogProps {
	open: boolean
	onClose: () => void
	onSelect: (musicUrl: string, musicName: string) => void
	currentMusic?: string
}

export function MusicSelectDialog({ open, onClose, onSelect, currentMusic }: MusicSelectDialogProps) {
	const [musicName, setMusicName] = useState('')
	const [previewFile, setPreviewFile] = useState<{ file: File; previewUrl: string } | null>(null)
	const [savedMusicList, setSavedMusicList] = useState<MusicItem[]>(initialMusicList as MusicItem[])
	const [localMusicList, setLocalMusicList] = useState<LocalMusicItem[]>([])
	const [isSaving, setIsSaving] = useState(false)
	const [isSyncing, setIsSyncing] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const { isAuth, setPrivateKey } = useAuthStore()
	const keyInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		if (open) {
			setMusicName('')
			setPreviewFile(null)
			// 加载本地音乐列表
			setLocalMusicList(getLocalMusicList())
			// 重新加载音乐列表（尝试从服务器获取最新版本）
			fetch('/api/music/list')
				.then(res => res.ok ? res.json() : null)
				.then(data => {
					if (data) {
						setSavedMusicList(data)
					}
				})
				.catch(() => {
					// 如果获取失败，使用默认列表
					setSavedMusicList(initialMusicList as MusicItem[])
				})
		}
	}, [open])

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		// 检查文件类型
		if (!file.type.startsWith('audio/')) {
			toast.error('请选择音频文件')
			return
		}

		const previewUrl = URL.createObjectURL(file)
		setPreviewFile({ file, previewUrl })
		setMusicName(file.name.replace(/\.[^/.]+$/, ''))
	}

	const handleSelectFromList = (music: MusicItem | LocalMusicItem) => {
		onSelect(music.url, music.name)
		toast.success('音乐已选择')
		onClose()
	}

	const handleSaveAndSelect = async () => {
		if (!previewFile) {
			toast.error('请选择音乐文件')
			return
		}

		setIsSaving(true)

		try {
			const newMusicName = musicName || previewFile.file.name.replace(/\.[^/.]+$/, '')
			// 保存文件到本地
			const musicItem = await saveMusicToLocal(previewFile.file, newMusicName)

			// 更新本地音乐列表
			setLocalMusicList(getLocalMusicList())

			// 选择音乐
			onSelect(musicItem.url, musicItem.name)

			toast.success('音乐已保存到本地并选择')
			onClose()
		} catch (error: any) {
			console.error('Failed to save music to local:', error)
			toast.error(`保存失败: ${error?.message || '未知错误'}`)
		} finally {
			setIsSaving(false)
		}
	}

	// 同步本地音乐到 GitHub
	const handleSyncToGitHub = async () => {
		if (!isAuth) {
			// 如果未认证，先选择密钥文件
			keyInputRef.current?.click()
			return
		}

		if (localMusicList.length === 0) {
			toast.info('没有需要同步的本地音乐')
			return
		}

		setIsSyncing(true)

		try {
			const musicFileItems = new Map<string, MusicFileItem>()
			const musicItemsToSync: MusicItem[] = []

			for (const localMusic of localMusicList) {
				if (localMusic.fileData) {
					// 本地文件，需要上传
					const file = await convertLocalMusicToFile(localMusic)
					if (file) {
						const hash = await hashFileSHA256(file)
						const ext = file.name.match(/\.[^.]+$/)?.[0] || '.mp3'
						const filename = `${hash}${ext}`
						const tempUrl = `temp-${Date.now()}-${hash}`

						musicFileItems.set(tempUrl, { file, hash })
						musicItemsToSync.push({
							name: localMusic.name,
							url: tempUrl
						})
					}
				}
			}

			// 合并到现有列表
			const updatedList = [...savedMusicList, ...musicItemsToSync]

			// 保存到 GitHub
			await pushMusic({
				musicList: updatedList,
				musicFileItems: musicFileItems.size > 0 ? musicFileItems : undefined
			})

			// 清空本地音乐列表
			setLocalMusicList([])
			localStorage.removeItem('local-music-list')

			// 重新加载 GitHub 音乐列表
			fetch('/api/music/list')
				.then(res => res.ok ? res.json() : null)
				.then(data => {
					if (data) {
						setSavedMusicList(data)
					}
				})
				.catch(() => {
					setSavedMusicList(initialMusicList as MusicItem[])
				})

			toast.success('本地音乐已同步到 GitHub')
		} catch (error: any) {
			console.error('Failed to sync music to GitHub:', error)
			toast.error(`同步失败: ${error?.message || '未知错误'}`)
		} finally {
			setIsSyncing(false)
		}
	}

	const handleChoosePrivateKey = async (file: File) => {
		try {
			const text = await file.text()
			await setPrivateKey(text)
			// 选择密钥后自动同步本地音乐到 GitHub
			await handleSyncToGitHub()
		} catch (error) {
			console.error('Failed to read private key:', error)
			toast.error('读取密钥文件失败')
		}
	}

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()

		if (previewFile) {
			// 使用本地文件（不保存到列表）
			const objectUrl = URL.createObjectURL(previewFile.file)
			onSelect(objectUrl, musicName || previewFile.file.name)
			toast.success('音乐已选择')
			onClose()
		} else {
			toast.error('请选择音乐文件')
		}
	}

	const handleClose = () => {
		if (previewFile) {
			URL.revokeObjectURL(previewFile.previewUrl)
		}
		setPreviewFile(null)
		setMusicName('')
		onClose()
	}

	useEffect(() => {
		return () => {
			if (previewFile) {
				URL.revokeObjectURL(previewFile.previewUrl)
			}
		}
	}, [previewFile])

	return (
		<>
			<input
				ref={keyInputRef}
				type='file'
				accept='.pem,.key'
				className='hidden'
				onChange={e => {
					const file = e.target.files?.[0]
					if (file) {
						void handleChoosePrivateKey(file)
					}
				}}
			/>
			<DialogModal open={open} onClose={handleClose} className='card w-md max-sm:w-full max-h-[90vh] overflow-y-auto'>
				<div className='space-y-4'>
					<div className='flex items-center justify-between'>
						<h2 className='text-xl font-bold'>选择音乐</h2>
						<button onClick={handleClose} className='text-secondary hover:text-primary rounded-lg p-1 transition-colors'>
							<X className='h-5 w-5' />
						</button>
					</div>

					{/* 本地音乐列表 */}
					{localMusicList.length > 0 && (
						<div>
							<div className='mb-2 flex items-center justify-between'>
								<label className='text-secondary block text-sm font-medium'>本地音乐（未同步）</label>
								{isAuth && (
									<motion.button
										type='button'
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleSyncToGitHub}
										disabled={isSyncing}
										className='text-secondary hover:text-primary flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors disabled:opacity-50'>
										<Upload className='h-3 w-3' />
										{isSyncing ? '同步中...' : '同步到 GitHub'}
									</motion.button>
								)}
							</div>
							<div className='max-h-48 space-y-2 overflow-y-auto rounded-lg border border-orange-300 bg-orange-50 p-2'>
								{localMusicList.map((music) => (
									<motion.div
										key={music.id}
										whileHover={{ scale: 1.02 }}
										whileTap={{ scale: 0.98 }}
										className={`flex w-full items-center gap-3 rounded-lg border p-3 transition-colors ${
											currentMusic === music.url
												? 'border-brand bg-brand/10'
												: 'border-orange-300 bg-white hover:bg-orange-50'
										}`}>
										<button
											type='button'
											onClick={() => handleSelectFromList(music)}
											className='flex flex-1 items-center gap-3 text-left'>
											<Music className='text-secondary h-5 w-5 flex-shrink-0' />
											<div className='flex-1'>
												<div className='font-medium'>{music.name}</div>
												<div className='text-secondary text-xs'>{music.fileData ? '本地文件' : music.url}</div>
											</div>
											{currentMusic === music.url && <Check className='text-brand h-5 w-5 flex-shrink-0' />}
										</button>
										<button
											type='button'
											onClick={e => {
												e.stopPropagation()
												removeLocalMusic(music.id)
												setLocalMusicList(getLocalMusicList())
												toast.success('已删除本地音乐')
											}}
											className='text-secondary hover:text-primary rounded-lg p-1 transition-colors flex-shrink-0'>
											<X className='h-4 w-4' />
										</button>
									</motion.div>
								))}
							</div>
						</div>
					)}

					{/* 已保存的音乐列表（GitHub） */}
					<div>
						<div className='mb-2 flex items-center justify-between'>
							<label className='text-secondary block text-sm font-medium'>已保存的音乐</label>
							<Cloud className='text-secondary h-4 w-4' />
						</div>
						<div className='max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 p-2'>
							{savedMusicList.length === 0 ? (
								<div className='text-secondary py-8 text-center text-sm'>暂无已保存的音乐</div>
							) : (
								savedMusicList.map((music, index) => (
									<motion.button
										key={index}
										type='button'
										whileHover={{ scale: 1.02 }}
										whileTap={{ scale: 0.98 }}
										onClick={() => handleSelectFromList(music)}
										className={`flex w-full items-center gap-3 rounded-lg border p-3 transition-colors ${
											currentMusic === music.url
												? 'border-brand bg-brand/10'
												: 'border-gray-300 bg-white hover:bg-gray-50'
										}`}>
										<Music className='text-secondary h-5 w-5 flex-shrink-0' />
										<div className='flex-1 text-left'>
											<div className='font-medium'>{music.name}</div>
											<div className='text-secondary text-xs'>{music.url}</div>
										</div>
										{currentMusic === music.url && <Check className='text-brand h-5 w-5 flex-shrink-0' />}
									</motion.button>
								))
							)}
						</div>
					</div>

					<div className='relative'>
						<div className='absolute inset-0 flex items-center'>
							<div className='w-full border-t border-gray-300'></div>
						</div>
						<div className='relative flex justify-center text-sm'>
							<span className='text-secondary rounded-lg bg-white px-4 py-1'>或</span>
						</div>
					</div>

					<form onSubmit={handleSubmit} className='space-y-4'>
						{/* 上传本地音乐文件 */}
						<div>
							<label className='text-secondary mb-2 block text-sm font-medium'>上传音乐文件</label>
							<input ref={fileInputRef} type='file' accept='audio/*' className='hidden' onChange={handleFileSelect} />
							<div
								onClick={() => fileInputRef.current?.click()}
								className='flex h-32 cursor-pointer items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 transition-colors hover:bg-secondary/10'>
								{previewFile ? (
									<div className='flex w-full items-center gap-3 px-4'>
										<div className='flex-1'>
											<p className='font-medium'>{previewFile.file.name}</p>
											<p className='text-secondary text-xs'>{Math.round(previewFile.file.size / 1024)} KB</p>
										</div>
										<button
											type='button'
											onClick={e => {
												e.stopPropagation()
												URL.revokeObjectURL(previewFile.previewUrl)
												setPreviewFile(null)
												if (fileInputRef.current) {
													fileInputRef.current.value = ''
												}
											}}
											className='text-secondary hover:text-primary rounded-lg p-1 transition-colors'>
											<X className='h-4 w-4' />
										</button>
									</div>
								) : (
									<div className='text-center'>
										<Plus className='text-secondary mx-auto mb-1 h-8 w-8' />
										<p className='text-secondary text-xs'>点击选择音乐文件</p>
									</div>
								)}
							</div>
						</div>

						{/* 音乐名称 */}
						<div>
							<label className='text-secondary mb-2 block text-sm font-medium'>音乐名称（可选）</label>
							<input
								type='text'
								value={musicName}
								onChange={e => setMusicName(e.target.value)}
								placeholder='输入音乐名称'
								className='focus:ring-brand w-full rounded-lg border border-gray-300 bg-gray-200 px-4 py-2 focus:ring-2 focus:outline-none'
							/>
						</div>

						<div className='flex gap-3 pt-2'>
							<motion.button
								type='button'
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={handleClose}
								className='flex-1 rounded-lg border bg-white/60 px-4 py-2 text-sm transition-colors hover:bg-white/80'>
								取消
							</motion.button>
							<motion.button
								type='button'
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={handleSaveAndSelect}
								disabled={isSaving}
								className='brand-btn flex-1 px-4 py-2 text-sm disabled:opacity-50'>
								{isSaving ? '保存中...' : '保存到本地并选择'}
							</motion.button>
							<motion.button
								type='submit'
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								className='flex-1 rounded-lg border bg-white/60 px-4 py-2 text-sm transition-colors hover:bg-white/80'>
								仅选择
							</motion.button>
						</div>
					</form>
				</div>
			</DialogModal>
		</>
	)
}
