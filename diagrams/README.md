# AWS アーキテクチャ図生成プロジェクト

このプロジェクトは、AWSのアーキテクチャ図をPythonの`diagrams`ライブラリを使用して生成するためのコードを提供します。

## プロジェクト構成

```
.
├── README.md
├── requirements.txt
├── aws_architecture1.py
├── aws_architecture2.py
├── aws_architecture3.py
└── .gitignore
```

## 環境設定

1. 必要なパッケージのインストール:
```bash
pip install -r requirements.txt
```

2. Graphvizのインストール:
- Windows: `winget install graphviz`
- macOS: `brew install graphviz`
- Linux: `sudo apt-get install graphviz`

## 使用方法

各アーキテクチャ図は個別のPythonファイルとして実装されています：

```bash
python aws_architecture1.py  # アーキテクチャ図1を生成
python aws_architecture2.py  # アーキテクチャ図2を生成
python aws_architecture3.py  # アーキテクチャ図3を生成
```

## アーキテクチャ3の構成

aws_architecture3.pyは以下のAWSコンポーネントを含むアーキテクチャを描画します：

### フロントエンド
- CloudFront: S3の静的コンテンツを配信
- S3: Reactのビルドファイルを格納

### CI/CD パイプライン
- CodePipeline: ソース取得からデプロイまでを管理
- CodeBuild: Reactアプリケーションのビルドを実行
- CodeCommit: ソースコードのバージョン管理

### バックエンド
- Lambda: APIエンドポイントとしてタスク管理機能を提供
- DynamoDB: タスク情報のデータストア

### ユーザーフロー
- エンドユーザー: CloudFront経由でアプリケーションにアクセス
- 開発者: CodeCommitにソースコードをプッシュ

## 必要要件

- Python 3.7以上
- Graphviz
- pip packages (requirements.txt参照)