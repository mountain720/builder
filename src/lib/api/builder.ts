import { AxiosRequestConfig } from 'axios'
import { env } from 'decentraland-commons'
import { BaseAPI, APIParam } from 'decentraland-dapps/dist/lib/api'
import { Omit } from 'decentraland-dapps/dist/lib/types'
import { runMigrations } from 'modules/migrations/utils'
import { migrations } from 'modules/migrations/manifest'
import { Project, Manifest } from 'modules/project/types'
import { Asset, AssetAction, AssetParameter } from 'modules/asset/types'
import { Scene, ModelMetrics } from 'modules/scene/types'
import { FullAssetPack } from 'modules/assetPack/types'
import { dataURLToBlob, isDataUrl, objectURLToBlob } from 'modules/media/utils'
import { createManifest } from 'modules/project/export'
import { PoolGroup } from 'modules/poolGroup/types'
import { Pool } from 'modules/pool/types'
import { Item, ItemType, ItemRarity, WearableData } from 'modules/item/types'
import { Collection } from 'modules/collection/types'
import { PreviewType } from 'modules/editor/types'
import { WeeklyStats } from 'modules/stats/types'
import { authorize } from './auth'

export const BUILDER_SERVER_URL = env.get('REACT_APP_BUILDER_SERVER_URL', '')

export const getContentsStorageUrl = (hash: string = '') => `${BUILDER_SERVER_URL}/storage/contents/${hash}`
export const getAssetPackStorageUrl = (hash: string = '') => `${BUILDER_SERVER_URL}/storage/assetPacks/${hash}`
export const getPreviewUrl = (projectId: string) => `${BUILDER_SERVER_URL}/projects/${projectId}/media/preview.png`

export type RemoteItem = {
  id: string // uuid
  name: string
  description: string
  thumbnail: string
  eth_address: string
  collection_id: string | null
  blockchain_item_id: string | null
  price: string | null
  beneficiary: string | null
  rarity: ItemRarity | null
  total_supply: number | null
  is_published: boolean
  is_approved: boolean
  in_catalyst: boolean
  type: ItemType
  data: WearableData
  metrics: ModelMetrics
  contents: Record<string, string>
  created_at: Date
  updated_at: Date
}

export type RemoteCollection = {
  id: string // uuid
  name: string
  eth_address: string
  salt: string | null
  contract_address: string | null
  is_published: boolean
  is_approved: boolean
  minters: string[]
  managers: string[]
  created_at: Date
  updated_at: Date
}

export type RemoteProject = {
  id: string
  title: string
  description: string
  thumbnail: string
  is_public: boolean
  scene_id: string
  eth_address: string
  rows: number
  cols: number
  created_at: string
  updated_at: string
}

export type RemotePoolGroup = {
  id: string
  name: string
  is_active: boolean
  active_from: string
  active_until: string
}

export type RemotePool = RemoteProject & {
  groups: string[]
  parcels: number | null
  transforms: number | null
  gltf_shapes: number | null
  nft_shapes: number | null
  scripts: number | null
  entities: number | null
  likes: number
  like: boolean
}

export type RemoteAssetPack = {
  id: string
  title: string
  url?: string
  thumbnail?: string
  eth_address: string
  assets: RemoteAsset[]
  created_at?: string
  updated_at?: string
}

export type RemoteAsset = {
  id: string
  asset_pack_id: string
  name: string
  model: string
  script: string | null
  thumbnail: string
  tags: string[]
  category: string
  contents: Record<string, string>
  metrics: ModelMetrics
  parameters: AssetParameter[]
  actions: AssetAction[]
}

export type RemoteWeeklyStats = {
  week: string
  title: string
  base: string
  users: number
  sessions: number
  median_session_time: number
  min_session_time: number
  average_session_time: number
  max_session_time: number
  direct_users: number
  direct_sessions: number
  max_concurrent_users: number
  max_concurrent_users_time: string
}

/**
 * Transforms a Project into a RemoteProject for saving purposes only.
 * The `thumbnail` is omitted.
 */
function toRemoteProject(project: Project): Omit<RemoteProject, 'thumbnail'> {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    is_public: project.isPublic,
    scene_id: project.sceneId,
    eth_address: project.ethAddress!,
    rows: project.layout.rows,
    cols: project.layout.cols,
    created_at: project.createdAt,
    updated_at: project.updatedAt
  }
}

function fromRemoteProject(remoteProject: RemoteProject): Project {
  return {
    id: remoteProject.id,
    title: remoteProject.title,
    description: remoteProject.description,
    thumbnail: `${BUILDER_SERVER_URL}/projects/${remoteProject.id}/media/thumbnail.png`,
    isPublic: !!remoteProject.is_public,
    sceneId: remoteProject.scene_id,
    ethAddress: remoteProject.eth_address,
    layout: {
      rows: remoteProject.rows,
      cols: remoteProject.cols
    },
    createdAt: remoteProject.created_at,
    updatedAt: remoteProject.updated_at
  }
}

function fromRemotePool(remotePool: RemotePool): Pool {
  const pool = fromRemoteProject(remotePool) as Pool

  pool.thumbnail = `${BUILDER_SERVER_URL}/projects/${remotePool.id}/media/preview.png`
  pool.isPublic = true
  ;(pool.groups = remotePool.groups || []), (pool.likes = remotePool.likes || 0), (pool.like = !!remotePool.like)

  if (remotePool.parcels) {
    pool.statistics = {
      parcels: remotePool.parcels as number,
      transforms: remotePool.transforms as number,
      gltf_shapes: remotePool.gltf_shapes as number,
      nft_shapes: remotePool.nft_shapes as number,
      scripts: remotePool.scripts as number,
      entities: remotePool.entities as number
    }
  }

  return pool
}

function toRemoteAssetPack(assetPack: FullAssetPack): RemoteAssetPack {
  return {
    id: assetPack.id,
    title: assetPack.title,
    eth_address: assetPack.ethAddress!,
    assets: assetPack.assets.map(asset => toRemoteAsset(asset))
  }
}

function fromRemoteAssetPack(remoteAssetPack: RemoteAssetPack): FullAssetPack {
  return {
    id: remoteAssetPack.id,
    title: remoteAssetPack.title,
    thumbnail: getAssetPackStorageUrl(remoteAssetPack.thumbnail),
    ethAddress: remoteAssetPack.eth_address,
    assets: remoteAssetPack.assets.map(asset => fromRemoteAsset(asset)),
    createdAt: remoteAssetPack.created_at,
    updatedAt: remoteAssetPack.updated_at
  }
}

function toRemoteAsset(asset: Asset): RemoteAsset {
  return {
    id: asset.id,
    asset_pack_id: asset.assetPackId,
    name: asset.name,
    model: asset.model.replace(`${asset.assetPackId}/`, ''),
    script: asset.script,
    thumbnail: asset.thumbnail.replace(getContentsStorageUrl(), ''),
    tags: asset.tags,
    category: asset.category,
    contents: asset.contents,
    metrics: asset.metrics,
    parameters: asset.parameters,
    actions: asset.actions
  }
}

function fromRemoteAsset(remoteAsset: RemoteAsset): Asset {
  return {
    id: remoteAsset.id,
    assetPackId: remoteAsset.asset_pack_id,
    name: remoteAsset.name,
    model: remoteAsset.model,
    script: remoteAsset.script,
    thumbnail: getContentsStorageUrl(remoteAsset.thumbnail),
    tags: remoteAsset.tags,
    category: remoteAsset.category,
    contents: remoteAsset.contents,
    metrics: remoteAsset.metrics,
    parameters: remoteAsset.parameters,
    actions: remoteAsset.actions
  }
}

function fromPoolGroup(poolGroup: RemotePoolGroup): PoolGroup {
  return {
    id: poolGroup.id,
    name: poolGroup.name,
    isActive: poolGroup.is_active,
    activeFrom: new Date(Date.parse(poolGroup.active_from)),
    activeUntil: new Date(Date.parse(poolGroup.active_until))
  }
}

function toRemoteItem(item: Item): RemoteItem {
  const remoteItem: RemoteItem = {
    id: item.id,
    name: item.name,
    description: item.description || '',
    thumbnail: item.thumbnail,
    eth_address: item.owner,
    collection_id: item.collectionId || null,
    blockchain_item_id: item.tokenId || null,
    price: item.price || null,
    beneficiary: item.beneficiary || null,
    rarity: item.rarity || null,
    total_supply: item.totalSupply === undefined ? null : item.totalSupply,
    is_published: item.isPublished || false,
    is_approved: item.isApproved || false,
    in_catalyst: item.inCatalyst || false,
    type: item.type,
    data: item.data,
    metrics: item.metrics,
    contents: item.contents,
    created_at: new Date(item.createdAt),
    updated_at: new Date(item.updatedAt)
  }

  return remoteItem
}

function fromRemoteItem(remoteItem: RemoteItem) {
  const item: Item = {
    id: remoteItem.id,
    name: remoteItem.name,
    thumbnail: remoteItem.thumbnail,
    owner: remoteItem.eth_address,
    description: remoteItem.description,
    isPublished: remoteItem.is_published,
    isApproved: remoteItem.is_approved,
    inCatalyst: remoteItem.in_catalyst,
    type: remoteItem.type,
    data: remoteItem.data,
    contents: remoteItem.contents,
    metrics: remoteItem.metrics,
    createdAt: +new Date(remoteItem.created_at),
    updatedAt: +new Date(remoteItem.created_at)
  }

  if (remoteItem.collection_id) item.collectionId = remoteItem.collection_id
  if (remoteItem.blockchain_item_id) item.tokenId = remoteItem.blockchain_item_id
  if (remoteItem.price) item.price = remoteItem.price
  if (remoteItem.beneficiary) item.beneficiary = remoteItem.beneficiary
  if (remoteItem.rarity) item.rarity = remoteItem.rarity
  if (remoteItem.total_supply !== null) item.totalSupply = remoteItem.total_supply // 0 is false

  return item
}

function toRemoteCollection(collection: Collection): RemoteCollection {
  const remoteCollection: RemoteCollection = {
    id: collection.id,
    name: collection.name,
    eth_address: collection.owner,
    is_published: collection.isPublished,
    is_approved: collection.isApproved,
    minters: collection.minters,
    managers: collection.managers,
    contract_address: collection.contractAddress || null,
    salt: collection.salt || null,
    created_at: new Date(collection.createdAt),
    updated_at: new Date(collection.updatedAt)
  }

  return remoteCollection
}

function fromRemoteCollection(remoteCollection: RemoteCollection) {
  const collection: Collection = {
    id: remoteCollection.id,
    name: remoteCollection.name,
    owner: remoteCollection.eth_address,
    isPublished: remoteCollection.is_published,
    isApproved: remoteCollection.is_approved,
    minters: remoteCollection.minters || [],
    managers: remoteCollection.managers || [],
    createdAt: +new Date(remoteCollection.created_at),
    updatedAt: +new Date(remoteCollection.updated_at)
  }

  if (remoteCollection.salt) collection.salt = remoteCollection.salt
  if (remoteCollection.contract_address) collection.contractAddress = remoteCollection.contract_address

  return collection
}

function fromRemoteWeeklyStats(remoteWeeklyStats: RemoteWeeklyStats): WeeklyStats {
  const {
    week,
    title,
    base,
    users,
    sessions,
    median_session_time,
    min_session_time,
    average_session_time,
    max_session_time,
    direct_users,
    direct_sessions,
    max_concurrent_users,
    max_concurrent_users_time
  } = remoteWeeklyStats
  return {
    week,
    title,
    base,
    users,
    sessions,
    medianSessionTime: median_session_time,
    minSessionTime: min_session_time,
    averageSessionTime: average_session_time,
    maxSessionTime: max_session_time,
    directUsers: direct_users,
    directSessions: direct_sessions,
    maxConcurrentUsers: max_concurrent_users,
    maxConcurrentUsersTime: max_concurrent_users_time
  }
}

export type PoolDeploymentAdditionalFields = {
  groups?: string[]
}

export type Sort = {
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export type Pagination = {
  limit?: number
  offset?: number
}

export type PoolFilters = {
  group?: string
  eth_address?: string
}

// API

export class BuilderAPI extends BaseAPI {
  request(method: AxiosRequestConfig['method'], path: string, params?: APIParam | null, config?: AxiosRequestConfig) {
    let authConfig = {}
    let headers = {}
    if (config) {
      authConfig = { ...config }
      if (config.headers) {
        headers = { ...config.headers }
      }
    }
    const authHeaders = authorize(method, path)
    headers = {
      ...headers,
      ...authHeaders
    }
    authConfig = { ...authConfig, headers }
    return super.request(method, path, params, authConfig)
  }

  async deployToPool(projectId: string, additionalInfo: PoolDeploymentAdditionalFields | null = null) {
    await this.request('put', `/projects/${projectId}/pool`, additionalInfo)
  }

  async uploadMedia(
    projectId: string,
    preview: Blob,
    shots: Record<string, Blob>,
    onUploadProgress?: (progress: { loaded: number; total: number }) => void
  ) {
    const formData = new FormData()
    formData.append('preview', preview)
    formData.append('north', shots.north)
    formData.append('east', shots.east)
    formData.append('south', shots.south)
    formData.append('west', shots.west)

    await this.request('post', `/projects/${projectId}/media`, formData, {
      onUploadProgress
    })
  }

  async fetchProjects() {
    const { items }: { items: RemoteProject[]; total: number } = await this.request('get', `/projects`)
    return items.map(fromRemoteProject)
  }

  async fetchPublicProject(projectId: string, type: 'public' | 'pool' = 'public') {
    const project: RemotePool = await this.request('get', `/projects/${projectId}/${type}`)
    return type === 'pool' ? fromRemotePool(project) : fromRemoteProject(project)
  }

  async fetchPoolsPage(filters: PoolFilters & Pagination & Sort) {
    const { items, total }: { items: RemotePool[]; total: number } = await this.request('get', '/pools', filters)
    return { items: items.map(fromRemotePool), total }
  }

  async fetchPoolGroups(activeOnly: boolean = false) {
    const items: RemotePoolGroup[] = await this.request('get', '/pools/groups', { activeOnly })
    return items.map(fromPoolGroup)
  }

  async saveProject(project: Project, scene: Scene) {
    const manifest = createManifest(toRemoteProject(project), scene)
    await this.request('put', `/projects/${project.id}/manifest`, { manifest })
  }

  async saveProjectThumbnail(project: Project) {
    const blob = dataURLToBlob(project.thumbnail)
    const formData = new FormData()
    if (blob) {
      formData.append('thumbnail', blob)
      await this.request('post', `/projects/${project.id}/media`, formData)
    }
  }

  async deleteProject(id: string) {
    await this.request('delete', `/projects/${id}`)
  }

  async fetchManifest(id: string, type: PreviewType.PROJECT | PreviewType.POOL | PreviewType.PUBLIC = PreviewType.PROJECT) {
    const remoteManifest = await this.request('get', `/${type}s/${id}/manifest`)
    const manifest = {
      ...remoteManifest,
      project: fromRemoteProject(remoteManifest.project)
    } as Manifest

    /* There are projects retrived from the cloud (S3, not DB) that don't have an ethAddress, even after migration (cos migration only impacts the DB),
       those projects can be loaded into the app state via the Scene Pool, and they end up with a null ethAddress, and are mixed with projects
       that the user created while being logged out (no ethAddress either). So to tell them appart we set them a placeholder value.
    */
    if (!manifest.project.ethAddress) {
      manifest.project.ethAddress = 'legacy'
    }

    return runMigrations(manifest, migrations)
  }

  async saveAssetPack(assetPack: FullAssetPack) {
    const remotePack = toRemoteAssetPack(assetPack)
    await this.request('put', `/assetPacks/${remotePack.id}`, { assetPack: remotePack })
  }

  async saveAssetContents(
    asset: Asset,
    contents: Record<string, Blob>,
    onUploadProgress?: (progress: { loaded: number; total: number }) => void
  ) {
    const formData = new FormData()

    for (let path in contents) {
      formData.append(path, contents[path])
    }

    await this.request('post', `/assetPacks/${asset.assetPackId}/assets/${asset.id}/files`, formData, {
      onUploadProgress
    })
  }

  async saveAssetPackThumbnail(assetPack: FullAssetPack) {
    let blob: Blob | null = null

    if (isDataUrl(assetPack.thumbnail)) {
      blob = dataURLToBlob(assetPack.thumbnail)
    } else {
      blob = await objectURLToBlob(assetPack.thumbnail)
    }

    if (!blob) throw new Error('Invalid thumbnail')

    const formData = new FormData()
    if (blob) {
      formData.append('thumbnail', blob)
      await this.request('post', `/assetPacks/${assetPack.id}/thumbnail`, formData)
    }
  }

  async fetchAssetPacks() {
    const remotePacks: RemoteAssetPack[] = await this.request('get', `/assetPacks`)
    return remotePacks.map(fromRemoteAssetPack)
  }

  async deleteAssetPack(assetPack: FullAssetPack) {
    await this.request('delete', `/assetPacks/${assetPack.id}`)
  }

  async likePool(pool: string, like: boolean = true) {
    const method = like ? 'put' : 'delete'
    return this.request(method, `/pools/${pool}/likes`)
  }

  async fetchItems() {
    const remoteItems: RemoteItem[] = await this.request('get', `/items`)
    return remoteItems.map(fromRemoteItem)
  }

  async fetchItem(id: string) {
    const remoteItem: RemoteItem = await this.request('get', `/items/${id}`)
    return fromRemoteItem(remoteItem)
  }

  async fetchCollectionItems(collectionId: string) {
    const remoteItems: RemoteItem[] = await this.request('get', `/collections/${collectionId}/items`)
    return remoteItems.map(fromRemoteItem)
  }

  async saveItem(item: Item, contents: Record<string, Blob>) {
    await this.request('put', `/items/${item.id}`, { item: toRemoteItem(item) })

    if (Object.keys(contents).length > 0) {
      const formData = new FormData()
      for (let path in contents) {
        formData.append(item.contents[path], contents[path])
      }

      await this.request('post', `/items/${item.id}/files`, formData)
    }
  }

  async deleteItem(item: Item) {
    await this.request('delete', `/items/${item.id}`, {})
  }

  async fetchCollections() {
    const remoteCollections: RemoteCollection[] = await this.request('get', `/collections`)
    const collections: Collection[] = []
    for (const remoteCollection of remoteCollections) {
      const collection = fromRemoteCollection(remoteCollection)
      collections.push(collection)
    }
    return collections
  }

  async fetchCollection(id: string) {
    const remoteCollection: RemoteCollection = await this.request('get', `/collections/${id}`)
    return fromRemoteCollection(remoteCollection)
  }

  async saveCollection(collection: Collection) {
    const remoteCollection = await this.request('put', `/collections/${collection.id}`, { collection: toRemoteCollection(collection) })
    return fromRemoteCollection(remoteCollection)
  }

  async deleteCollection(collection: Collection) {
    await this.request('delete', `/collections/${collection.id}`, {})
  }

  async getWeeklyStats(base: string) {
    const remoteStats: RemoteWeeklyStats = await this.request('get', `/analytics/weekly?base=${base}`)
    return fromRemoteWeeklyStats(remoteStats)
  }
}

export const builder = new BuilderAPI(BUILDER_SERVER_URL)
