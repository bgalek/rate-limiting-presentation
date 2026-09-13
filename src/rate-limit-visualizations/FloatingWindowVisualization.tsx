import AlgorithmVisualization, {
  type AlgorithmVisualizationProps,
} from './AlgorithmVisualization'

export type FloatingWindowVisualizationProps = Omit<
  AlgorithmVisualizationProps,
  'algorithm'
>

export default function FloatingWindowVisualization(
  props: FloatingWindowVisualizationProps,
) {
  return <AlgorithmVisualization {...props} algorithm="floating-window" />
}
