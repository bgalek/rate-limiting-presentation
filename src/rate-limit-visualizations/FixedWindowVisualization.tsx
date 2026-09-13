import AlgorithmVisualization, {
  type AlgorithmVisualizationProps,
} from './AlgorithmVisualization'

export type FixedWindowVisualizationProps = Omit<
  AlgorithmVisualizationProps,
  'algorithm'
>

export default function FixedWindowVisualization(
  props: FixedWindowVisualizationProps,
) {
  return <AlgorithmVisualization {...props} algorithm="fixed-window" />
}
