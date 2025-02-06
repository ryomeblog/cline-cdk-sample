from diagrams import Diagram, Edge, Cluster
from diagrams.aws.storage import S3
from diagrams.aws.network import CloudFront
from diagrams.aws.devtools import Codebuild, Codecommit, Codepipeline
from diagrams.aws.compute import Lambda
from diagrams.aws.database import Dynamodb
from diagrams.onprem.client import Client

graph_attr = {
    "rankdir": "LR",
    "ratio": "1.7",  # 横長の比率を設定
    "splines": "ortho",  # 直角の線を使用
    "pad": "0.5"  # パディングを追加
}

with Diagram(
    "AWS Architecture3",
    show=False,
    direction="LR",
    graph_attr=graph_attr
):
    # アクター
    developer = Client("Developer")
    end_user = Client("End User")

    with Cluster("CI/CD Pipeline"):
        # 開発者ツール
        repo = Codecommit("Source\nRepository")
        pipeline = Codepipeline("CI/CD\nPipeline")
        build = Codebuild("React\nBuild")

    with Cluster("Frontend"):
        # ストレージとCDN
        s3 = S3("Static Content\nStorage")
        cdn = CloudFront("Content\nDelivery")

    with Cluster("Backend"):
        # サーバーレスバックエンド
        lambda_func = Lambda("API\nFunction")
        dynamodb = Dynamodb("Task\nDatabase")

    # CI/CDフロー
    developer >> Edge(label="git push") >> repo
    repo >> Edge(label="Source") >> pipeline
    pipeline >> Edge(label="Build") >> build
    build >> Edge(label="Deploy") >> s3

    # フロントエンドアクセス
    cdn >> Edge(label="Origin") >> s3
    end_user >> Edge(label="Access") >> cdn

    # バックエンドアクセス
    cdn >> Edge(label="API Call") >> lambda_func
    lambda_func >> Edge(label="CRUD\nOperations") >> dynamodb
