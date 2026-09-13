import AlgorithmVisualization, {
  type AlgorithmVisualizationProps,
} from './AlgorithmVisualization'

export type UserFixedWindowVisualizationProps = Omit<
  AlgorithmVisualizationProps,
  'algorithm'
>

export default function UserFixedWindowVisualization(
  props: UserFixedWindowVisualizationProps,
) {
  return <AlgorithmVisualization {...props} algorithm="user-fixed-window" />
}
