# インフラストラクチャアーキテクチャ詳細

## 概要

![アーキテクチャ図](../aws_architecture3.png)

このアーキテクチャは、モダンなWebアプリケーションのベストプラクティスに従い、以下の要件を満たすように設計されています：

- セキュアなホスティングと通信
- サーバーレスアーキテクチャによる運用コストの最適化
- 継続的デプロイメントの自動化
- スケーラブルなインフラストラクチャ

## コンポーネント詳細

### 1. フロントエンドインフラストラクチャ

#### S3 + CloudFront構成
```javascript
// S3バケットの作成 - プライベートアクセス設定
const websiteBucket = new s3.Bucket(this, 'ReactWebsiteBucket', {
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
});

// CloudFront配信設定
const distribution = new cloudfront.Distribution(this, 'ReactWebsiteDistribution', {
  defaultBehavior: {
    origin: new origins.S3Origin(websiteBucket, {
      originAccessIdentity,
    }),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
  },
  // SPAのルーティング対応
  errorResponses: [
    {
      httpStatus: 404,
      responseHttpStatus: 200,
      responsePagePath: '/index.html',
    },
  ],
});
```

**設計理由：**
- S3バケットは完全プライベート化：セキュリティのベストプラクティス
- CloudFrontによるHTTPS強制：通信の暗号化
- カスタムエラーレスポンス：SPAのクライアントサイドルーティング対応
- OAI（Origin Access Identity）：S3への直接アクセスを防止

### 2. バックエンドインフラストラクチャ

#### DynamoDB設計
```javascript
const tasksTable = new dynamodb.Table(this, 'TasksTable', {
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
});
```

**設計理由：**
- オンデマンドキャパシティ：
  - 予測不可能なワークロードに対応
  - コスト最適化（使用分のみ課金）
- シンプルなキー設計：
  - 単一パーティションキー（id）による高速なルックアップ
  - 将来の拡張性を考慮

#### Lambda関数設計
```javascript
const tasksFunction = new lambda.Function(this, 'TasksFunction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'index.handler',
  role: lambdaRole,
  environment: {
    TABLE_NAME: tasksTable.tableName
  }
});

// APIパスルーティング（CloudFront経由）
additionalBehaviors: {
  '/api/*': {
    origin: new origins.HttpOrigin(`${tasksFunction.functionName}.lambda-url.${this.region}.amazonaws.com`),
    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
  }
}
```

**設計理由：**
- Node.js 18.x採用：
  - LTSバージョンによる長期安定性
  - 最新のJavaScript機能サポート
- 環境変数の活用：
  - 設定の外部化
  - デプロイ環境による動的な値の注入
- CloudFront統合：
  - 単一ドメインでのAPI提供
  - CORSの回避
  - キャッシュの無効化（リアルタイムレスポンス）

### 3. CI/CDパイプライン

#### CodePipelineの構成
```javascript
const pipeline = new codepipeline.Pipeline(this, 'ReactAppPipeline', {
  stages: [
    {
      stageName: 'Source',
      actions: [sourceAction], // CodeCommitソース
    },
    {
      stageName: 'Build',
      actions: [buildAction], // CodeBuildによるビルド
    },
    {
      stageName: 'Deploy',
      actions: [deployAction], // S3デプロイ + CloudFront更新
    }
  ]
});
```

**設計理由：**
- 3ステージパイプライン：
  - シンプルで信頼性の高いデプロイフロー
  - 各ステージの明確な責務分離
- CodeCommit採用：
  - AWSマネージドサービスによる運用負荷軽減
  - IAMとの統合による細かなアクセス制御
- CloudFrontキャッシュ更新の自動化：
  - デプロイ後の即時反映
  - エンドユーザーエクスペリエンスの向上

## セキュリティ設計

### IAMロールと権限管理
```javascript
const lambdaRole = new iam.Role(this, 'TasksLambdaRole', {
  assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
});

// 必要最小限の権限付与
tasksTable.grantReadWriteData(lambdaRole);
```

**実装されているセキュリティ対策：**
1. 最小権限の原則
2. サービス間の適切な認証
3. パブリックアクセスの制限
4. HTTPS通信の強制
5. リソース単位のアクセス制御

## スケーラビリティと運用性

### 自動スケーリング
- DynamoDB: オンデマンドキャパシティによる自動スケーリング
- Lambda: 同時実行数の自動管理
- CloudFront: エッジロケーションによるグローバルスケール

### モニタリングとロギング
- CloudWatchメトリクス統合
- X-Ray分散トレーシング対応可能
- 各サービスのログ自動収集

### コスト最適化
- サーバーレスアーキテクチャによる使用量ベースの課金
- CloudFrontキャッシュによるオリジンリクエスト削減
- オンデマンドキャパシティによる無駄のない課金

## 運用上の注意点

### 開発環境特有の設定
```javascript
// 開発環境用の設定例
const tasksTable = new dynamodb.Table(this, 'TasksTable', {
  removalPolicy: RemovalPolicy.DESTROY, // 開発環境のみ
});

const websiteBucket = new s3.Bucket(this, 'ReactWebsiteBucket', {
  autoDeleteObjects: true, // 開発環境のみ
});
```

本番環境では以下の変更が必要：
1. RemovalPolicyの`RETAIN`への変更
2. バックアップ設定の追加
3. より厳格なIAMポリシーの適用
4. アラームとモニタリングの強化

### デプロイ戦略
- ブルーグリーンデプロイメント可能な構成
- ロールバック手順の確立
- 段階的なトラフィック移行の実装可能