import { Dispatch } from 'redux'
import { CallHistoryMethodAction } from 'connected-react-router'

export enum NavigationTab {
  SCENES = 'scenes',
  LAND = 'land',
  AVATAR = 'avatar',
  NAMES = 'names'
}

export type Props = {
  children?: React.ReactNode
  activeTab?: NavigationTab
  isFullscreen?: boolean
  onNavigate: (path: string) => void
}

export type MapStateProps = {}
export type MapDispatchProps = Pick<Props, 'onNavigate'>
export type MapDispatch = Dispatch<CallHistoryMethodAction>
