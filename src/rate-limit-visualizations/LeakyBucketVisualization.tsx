import AlgorithmVisualization, {
  type AlgorithmVisualizationProps,
} from './AlgorithmVisualization'

export type LeakyBucketVisualizationProps = Omit<
  AlgorithmVisualizationProps,
  'algorithm'
>

export default function LeakyBucketVisualization(
  props: LeakyBucketVisualizationProps,
) {
  return <AlgorithmVisualization {...props} algorithm="leaky-bucket" />
}
