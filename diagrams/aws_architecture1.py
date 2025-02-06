from diagrams import Diagram
from diagrams.aws.storage import S3
from diagrams.aws.network import CloudFront

with Diagram("AWS Architecture1", show=False):
    cf = CloudFront("CloudFront\nDistribution")
    s3 = S3("React\nBuild Files")

    cf >> s3
