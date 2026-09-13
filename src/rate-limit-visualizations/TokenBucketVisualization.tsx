import AlgorithmVisualization, {
  type AlgorithmVisualizationProps,
} from './AlgorithmVisualization'

export type TokenBucketVisualizationProps = Omit<
  AlgorithmVisualizationProps,
  'algorithm'
>

export default function TokenBucketVisualization(
  props: TokenBucketVisualizationProps,
) {
  return <AlgorithmVisualization {...props} algorithm="token-bucket" />
}
