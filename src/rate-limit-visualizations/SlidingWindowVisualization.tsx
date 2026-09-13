import AlgorithmVisualization, {
  type AlgorithmVisualizationProps,
} from './AlgorithmVisualization'

export type SlidingWindowVisualizationProps = Omit<
  AlgorithmVisualizationProps,
  'algorithm'
>

export default function SlidingWindowVisualization(
  props: SlidingWindowVisualizationProps,
) {
  return <AlgorithmVisualization {...props} algorithm="sliding-window" />
}
