import type { LessonMeta } from '../types'

// ── Track definitions ──────────────────────────────────
export interface Track {
  id: string
  name: string
  color: string
  icon: string
  description: string
  firstLesson: string
}

export const TRACKS: Track[] = [
  {
    id: 'foundations',
    name: 'Foundations',
    color: 'purple',
    icon: 'book',
    description: 'Math refreshers — vectors, matrices, calculus, probability, and Bayes.',
    firstLesson: 'Vectors',
  },
  {
    id: 'classical',
    name: 'Classical ML',
    color: 'teal',
    icon: 'chart',
    description: 'Regression, classification, clustering, and ensemble methods.',
    firstLesson: 'LinearRegression',
  },
  {
    id: 'neural',
    name: 'Neural Networks',
    color: 'orange',
    icon: 'network',
    description: 'Perceptrons, multi-layer networks, backprop, activations, and optimizers.',
    firstLesson: 'Perceptron',
  },
  {
    id: 'deep',
    name: 'Deep Learning',
    color: 'amber',
    icon: 'layers',
    description: 'CNNs, RNNs, word embeddings, attention, transformers, and transfer learning.',
    firstLesson: 'CNN',
  },
  {
    id: 'advanced',
    name: 'Advanced Topics',
    color: 'blue',
    icon: 'rocket',
    description: 'Reinforcement learning, generative models, and LLMs.',
    firstLesson: 'ReinforcementLearning',
  },
  {
    id: 'practical',
    name: 'Practical ML',
    color: 'gray',
    icon: 'wrench',
    description: 'Evaluation, deployment, MLOps, and best practices.',
    firstLesson: 'DataPreprocessing',
  },
  {
    id: 'systems',
    name: 'System Design',
    color: 'rose',
    icon: 'server',
    description: 'Data-intensive application design: reliability, data models, storage engines, and distributed systems.',
    firstLesson: 'Foundations',
  },
]

// ── Lesson registry ─────────────────────────────────────
export interface LessonEntry extends LessonMeta {
  file: string
}

const allLessons: LessonEntry[] = [
  // ── Foundations (6) ──
  { id: 'foundations/vectors', file: 'Vectors', title: 'Vectors & Spaces', description: 'Vector operations, dot products, projections, and basis vectors', track: 'foundations', order: 1, tags: ['vectors', 'dot-product', 'projections'] },
  { id: 'foundations/matrices', file: 'Matrices', title: 'Matrices & Transformations', description: 'Matrix multiplication, transformations, determinants, and eigenvalues', track: 'foundations', order: 2, tags: ['matrices', 'eigenvalues', 'transformations'] },
  { id: 'foundations/derivatives', file: 'Derivatives', title: 'Derivatives & Tangent Lines', description: 'Slopes, tangent lines, common derivatives, and rates of change', track: 'foundations', order: 3, tags: ['derivatives', 'tangent', 'calculus'] },
  { id: 'foundations/gradients', file: 'Gradients', title: 'Partial Derivatives & Gradients', description: 'Multivariable functions, gradient vectors, and gradient descent', track: 'foundations', order: 4, tags: ['gradients', 'partial-derivatives', 'gradient-descent'] },
  { id: 'foundations/distributions', file: 'Distributions', title: 'Probability Distributions', description: 'Bernoulli, Gaussian, Poisson, and the Central Limit Theorem', track: 'foundations', order: 5, tags: ['probability', 'gaussian', 'clt'] },
  { id: 'foundations/bayes', file: 'BayesTheorem', title: "Bayes' Theorem & Statistical Thinking", description: 'Conditional probability, priors, posteriors, and Bayesian updating', track: 'foundations', order: 6, tags: ['bayes', 'conditional-probability', 'posterior'] },

  // ── Classical ML (12) ──
  { id: 'classical/linear-regression', file: 'LinearRegression', title: 'Linear Regression', description: 'OLS, MSE, gradient descent fitting, and residual analysis', track: 'classical', order: 1, tags: ['regression', 'linear', 'mse', 'gradient-descent'] },
  { id: 'classical/polynomial-regression', file: 'PolynomialRegression', title: 'Polynomial Regression', description: 'Fitting curves, overfitting vs underfitting, and the bias-variance tradeoff', track: 'classical', order: 2, tags: ['polynomial', 'overfitting', 'bias-variance'] },
  { id: 'classical/logistic-regression', file: 'LogisticRegression', title: 'Logistic Regression', description: 'Sigmoid function, decision boundaries, and cross-entropy loss', track: 'classical', order: 3, tags: ['classification', 'logistic', 'sigmoid', 'cross-entropy'] },
  { id: 'classical/regularization', file: 'Regularization', title: 'Regularization', description: 'L2 (Ridge), L1 (Lasso), Elastic Net, and choosing lambda', track: 'classical', order: 4, tags: ['regularization', 'ridge', 'lasso', 'elastic-net'] },
  { id: 'classical/knn', file: 'KNN', title: 'K-Nearest Neighbors', description: 'Distance metrics, K selection, decision boundaries, and curse of dimensionality', track: 'classical', order: 5, tags: ['knn', 'distance', 'classification'] },
  { id: 'classical/svm', file: 'SVM', title: 'Support Vector Machines', description: 'Maximum margins, support vectors, soft margins, and the kernel trick', track: 'classical', order: 6, tags: ['svm', 'margin', 'kernel', 'rbf'] },
  { id: 'classical/decision-trees', file: 'DecisionTrees', title: 'Decision Trees', description: 'Gini impurity, recursive splits, depth control, and feature importance', track: 'classical', order: 7, tags: ['decision-trees', 'gini', 'splits'] },
  { id: 'classical/random-forests', file: 'RandomForests', title: 'Random Forests & Bagging', description: 'Bootstrap aggregating, voting, and ensemble stability', track: 'classical', order: 8, tags: ['random-forest', 'bagging', 'ensemble'] },
  { id: 'classical/gradient-boosting', file: 'GradientBoosting', title: 'Gradient Boosting', description: 'AdaBoost, gradient boosting, shrinkage, and XGBoost', track: 'classical', order: 9, tags: ['boosting', 'adaboost', 'xgboost'] },
  { id: 'classical/kmeans', file: 'KMeans', title: 'K-Means Clustering', description: 'Centroid iteration, elbow method, silhouette score, and limitations', track: 'classical', order: 10, tags: ['clustering', 'kmeans', 'unsupervised'] },
  { id: 'classical/pca', file: 'PCA', title: 'PCA & Dimensionality Reduction', description: 'Principal components, variance explained, projections, and t-SNE', track: 'classical', order: 11, tags: ['pca', 'dimensionality-reduction', 'tsne'] },
  { id: 'classical/model-evaluation', file: 'ModelEvaluation', title: 'Model Evaluation', description: 'Confusion matrix, precision, recall, F1, ROC, AUC, and cross-validation', track: 'classical', order: 12, tags: ['evaluation', 'precision', 'recall', 'roc', 'cross-validation'] },

  // ── Neural Networks (5) ──
  { id: 'neural/perceptron', file: 'Perceptron', title: 'The Perceptron', description: 'Single neuron, weights, bias, learning rule, and linear separability', track: 'neural', order: 1, tags: ['perceptron', 'neuron', 'learning-rule'] },
  { id: 'neural/multi-layer', file: 'MultiLayerNetworks', title: 'Multi-Layer Networks', description: 'Architecture, forward pass, universal approximation, and XOR', track: 'neural', order: 2, tags: ['mlp', 'forward-pass', 'universal-approximation'] },
  { id: 'neural/backpropagation', file: 'Backpropagation', title: 'Backpropagation', description: 'Chain rule, gradient flow, and vanishing gradients', track: 'neural', order: 3, tags: ['backprop', 'chain-rule', 'vanishing-gradients'] },
  { id: 'neural/activation-functions', file: 'ActivationFunctions', title: 'Activation Functions', description: 'Sigmoid, ReLU, tanh, Leaky ReLU, ELU, and softmax', track: 'neural', order: 4, tags: ['activation', 'relu', 'sigmoid', 'softmax'] },
  { id: 'neural/optimizers', file: 'Optimizers', title: 'Optimizers', description: 'SGD, Momentum, RMSProp, Adam, and learning rate schedules', track: 'neural', order: 5, tags: ['sgd', 'momentum', 'adam', 'learning-rate'] },

  // ── Deep Learning (8+) ──
  { id: 'deep/cnn', file: 'CNN', title: 'Convolutional Neural Networks', description: 'Convolutions, filters, pooling, and feature maps', track: 'deep', order: 1, tags: ['cnn', 'convolution', 'pooling', 'filters'] },
  { id: 'deep/rnn', file: 'RNN', title: 'RNNs & LSTMs', description: 'Recurrent neurons, BPTT, vanishing gradients, LSTM gates, and GRU', track: 'deep', order: 2, tags: ['rnn', 'lstm', 'gru', 'sequences'] },
  { id: 'deep/word-embeddings', file: 'WordEmbeddings', title: 'Word Embeddings & Vector Space', description: 'Word2Vec, cosine similarity, vector analogies, and embedding spaces', track: 'deep', order: 3, tags: ['embeddings', 'word2vec', 'cosine-similarity', 'analogies'] },
  { id: 'deep/self-attention', file: 'SelfAttention', title: 'Self-Attention', description: 'Query/Key/Value, scaled dot-product attention, and attention weights', track: 'deep', order: 4, tags: ['attention', 'qkv', 'softmax'] },
  { id: 'deep/transformer', file: 'Transformer', title: 'The Transformer', description: 'Multi-head attention, positional encoding, and the full architecture', track: 'deep', order: 5, tags: ['transformer', 'multi-head', 'positional-encoding'] },
  { id: 'deep/transfer-learning', file: 'TransferLearning', title: 'Transfer Learning', description: 'Feature extraction, fine-tuning, and foundation models', track: 'deep', order: 6, tags: ['transfer-learning', 'fine-tuning', 'pretrained'] },
  { id: 'deep/tokenization', file: 'Tokenization', title: 'Tokenization Deep Dive', description: 'BPE step by step, vocabulary building, subword merges, and special tokens', track: 'deep', order: 7, tags: ['tokenization', 'bpe', 'subword', 'vocabulary'] },
  { id: 'deep/pretraining', file: 'Pretraining', title: 'Language Model Pretraining', description: 'Autoregressive generation, causal masking, perplexity, and scaling laws', track: 'deep', order: 8, tags: ['pretraining', 'autoregressive', 'perplexity', 'scaling-laws'] },
  { id: 'deep/alignment', file: 'Alignment', title: 'Fine-Tuning & Alignment', description: 'SFT, RLHF, DPO, reward models, and aligning LLMs with human intent', track: 'deep', order: 9, tags: ['alignment', 'rlhf', 'dpo', 'sft', 'fine-tuning'] },
  { id: 'deep/prompting', file: 'Prompting', title: 'Prompting & In-Context Learning', description: 'Zero/few-shot, chain-of-thought, RAG, tool use, and agents', track: 'deep', order: 10, tags: ['prompting', 'few-shot', 'chain-of-thought', 'rag', 'agents'] },

  // ── Advanced (5) ──
  { id: 'advanced/reinforcement-learning', file: 'ReinforcementLearning', title: 'Reinforcement Learning', description: 'Agents, environments, rewards, Q-learning, and the exploration-exploitation tradeoff', track: 'advanced', order: 1, tags: ['reinforcement-learning', 'q-learning', 'mdp', 'epsilon-greedy', 'td-learning'] },
  { id: 'advanced/policy-gradients', file: 'PolicyGradients', title: 'Policy Gradients & Deep RL', description: 'From value-based to policy-based methods: REINFORCE, actor-critic, and the challenges of deep RL', track: 'advanced', order: 2, tags: ['policy-gradient', 'reinforce', 'actor-critic', 'deep-rl', 'reward-shaping'] },
  { id: 'advanced/gans', file: 'GANs', title: 'Generative Adversarial Networks', description: 'Generator vs. discriminator, training dynamics, mode collapse, and Wasserstein GANs', track: 'advanced', order: 3, tags: ['gan', 'generative', 'discriminator', 'mode-collapse', 'wasserstein'] },
  { id: 'advanced/vaes', file: 'VAEs', title: 'Variational Autoencoders', description: 'Latent spaces, the ELBO loss, reparameterization trick, and generation', track: 'advanced', order: 4, tags: ['vae', 'autoencoder', 'latent-space', 'elbo', 'generative'] },
  { id: 'advanced/llms', file: 'LLMs', title: 'Large Language Models', description: 'Next-token prediction, tokenization, scaling laws, temperature, and alignment', track: 'advanced', order: 5, tags: ['llm', 'language-model', 'tokenization', 'scaling', 'rlhf'] },

  // ── Practical (5) ──
  { id: 'practical/data-preprocessing', file: 'DataPreprocessing', title: 'Data Preprocessing', description: 'Cleaning, scaling, encoding, and balancing real-world data before it ever touches a model', track: 'practical', order: 1, tags: ['preprocessing', 'missing-values', 'scaling', 'encoding', 'imbalanced', 'outliers'] },
  { id: 'practical/feature-engineering', file: 'FeatureEngineering', title: 'Feature Engineering', description: 'Selecting, creating, and transforming features to improve model performance', track: 'practical', order: 2, tags: ['feature-engineering', 'feature-selection', 'correlation', 'polynomial', 'pca', 'importance'] },
  { id: 'practical/hyperparameter-tuning', file: 'HyperparameterTuning', title: 'Hyperparameter Tuning', description: 'Grid search, random search, Bayesian optimization, and early stopping for finding the best model configuration', track: 'practical', order: 3, tags: ['hyperparameters', 'grid-search', 'random-search', 'bayesian-optimization', 'early-stopping', 'cross-validation'] },
  { id: 'practical/model-deployment', file: 'ModelDeployment', title: 'Model Deployment & MLOps', description: 'From notebook to production: model serialization, serving patterns, A/B testing, monitoring, and CI/CD for ML', track: 'practical', order: 4, tags: ['deployment', 'mlops', 'serving', 'monitoring', 'drift', 'ci-cd'] },
  { id: 'practical/responsible-ai', file: 'ResponsibleAI', title: 'Responsible AI', description: 'Fairness, bias, interpretability, SHAP values, privacy, and practical guidelines for ethical ML', track: 'practical', order: 5, tags: ['fairness', 'bias', 'interpretability', 'shap', 'ethics', 'responsible-ai'] },

  // ── System Design (10) ──
  { id: 'systems/foundations', file: 'Foundations', title: 'Reliability, Scalability & Maintainability', description: 'The three pillars of data-intensive applications', track: 'systems', order: 1, tags: ['reliability', 'scalability', 'maintainability', 'latency', 'sla'] },
  { id: 'systems/data-models', file: 'DataModels', title: 'Data Models & Query Languages', description: 'Relational, document, and graph models and their query languages', track: 'systems', order: 2, tags: ['relational', 'document', 'graph', 'sql', 'nosql'] },
  { id: 'systems/storage-engines', file: 'StorageEngines', title: 'Storage Engines', description: 'LSM-trees vs B-trees — how databases store and retrieve data', track: 'systems', order: 3, tags: ['lsm-tree', 'b-tree', 'sstable', 'compaction'] },
  { id: 'systems/encoding', file: 'Encoding', title: 'Encoding & Evolution', description: 'Protobuf, Avro, schema evolution, and forward/backward compatibility', track: 'systems', order: 4, tags: ['encoding', 'protobuf', 'avro', 'schema-evolution', 'compatibility'] },
  { id: 'systems/replication', file: 'Replication', title: 'Replication', description: 'Leader/follower, multi-leader, leaderless replication, and quorums', track: 'systems', order: 5, tags: ['replication', 'leader', 'follower', 'quorum', 'consistency'] },
  { id: 'systems/partitioning', file: 'Partitioning', title: 'Partitioning (Sharding)', description: 'Hash vs range partitioning, consistent hashing, and rebalancing', track: 'systems', order: 6, tags: ['partitioning', 'sharding', 'consistent-hashing', 'rebalancing'] },
  { id: 'systems/transactions', file: 'Transactions', title: 'Transactions & ACID', description: 'Isolation levels, MVCC, two-phase locking, and distributed transactions', track: 'systems', order: 7, tags: ['transactions', 'acid', 'isolation', 'mvcc', '2pc'] },
  { id: 'systems/consensus', file: 'Consensus', title: 'Consistency & Consensus', description: 'CAP theorem, linearizability, Raft consensus, and distributed locks', track: 'systems', order: 8, tags: ['cap', 'linearizability', 'raft', 'consensus', 'vector-clocks'] },
  { id: 'systems/batch-stream', file: 'BatchStream', title: 'Batch & Stream Processing', description: 'MapReduce, event sourcing, CDC, and exactly-once semantics', track: 'systems', order: 9, tags: ['mapreduce', 'streaming', 'event-sourcing', 'cdc'] },
  { id: 'systems/design-patterns', file: 'DesignPatterns', title: 'System Design Patterns', description: 'Load balancing, caching, rate limiting, circuit breakers, and message queues', track: 'systems', order: 10, tags: ['load-balancing', 'caching', 'rate-limiting', 'circuit-breaker'] },
  { id: 'systems/kafka-foundations', file: 'KafkaFoundations', title: 'Event-Driven Architecture & Kafka Fundamentals', description: 'From request-response to event-driven systems — topics, partitions, consumer groups, delivery guarantees, and replication in Apache Kafka', track: 'systems', order: 11, tags: ['kafka', 'event-driven', 'partitions', 'consumer-groups', 'replication', 'delivery-guarantees'] },
  { id: 'systems/kafka-practice', file: 'KafkaInPractice', title: 'Kafka in Real-World Systems', description: 'Four production Kafka architectures — real-time betting, social media fan-out, infrastructure monitoring, and webhook delivery — plus operational best practices', track: 'systems', order: 12, tags: ['kafka', 'system-design', 'betting', 'webhooks', 'monitoring', 'kafka-connect', 'schema-registry'] },
]

/** All lessons sorted by track order then lesson order. */
export const LESSONS: LessonEntry[] = (() => {
  const trackOrder = new Map(TRACKS.map((t, i) => [t.id, i]))
  return [...allLessons].sort((a, b) => {
    const ta = trackOrder.get(a.track) ?? 999
    const tb = trackOrder.get(b.track) ?? 999
    if (ta !== tb) return ta - tb
    return a.order - b.order
  })
})()

/** Return lessons for a specific track, sorted by order. */
export function getLessonsByTrack(track: string): LessonEntry[] {
  return LESSONS.filter((l) => l.track === track)
}

/** Find a lesson by its file slug and track */
export function getLessonByFile(track: string, file: string): LessonEntry | undefined {
  return LESSONS.find((l) => l.track === track && l.file === file)
}

/** Get the first lesson for a track */
export function getFirstLesson(trackId: string): string {
  const track = TRACKS.find((t) => t.id === trackId)
  return track?.firstLesson ?? 'intro'
}
