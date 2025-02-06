from diagrams import Diagram, Edge, Cluster
from diagrams.aws.storage import S3
from diagrams.aws.network import CloudFront
from diagrams.aws.devtools import Codebuild, Codecommit, Codepipeline
from diagrams.onprem.client import Client

graph_attr = {
    "rankdir": "LR",
    "ratio": "1.7",  # 横長の比率を設定
    "splines": "ortho"  # 直角の線を使用
}

with Diagram(
    "AWS Architecture2",
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

    # ストレージとCDN
    s3 = S3("Build Files\nStorage")
    cdn = CloudFront("Content\nDelivery")

    # デプロイメントフロー
    developer >> Edge(label="git push") >> repo
    repo >> Edge(label="Source") >> pipeline
    pipeline >> Edge(label="Build") >> build
    build >> Edge(label="Deploy") >> s3
    cdn >> Edge(label="Origin") >> s3
    end_user >> Edge(label="Access") >> cdn
