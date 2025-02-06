const { Stack, Duration, RemovalPolicy, CfnOutput } = require('aws-cdk-lib');
const s3 = require('aws-cdk-lib/aws-s3');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const codecommit = require('aws-cdk-lib/aws-codecommit');
const codebuild = require('aws-cdk-lib/aws-codebuild');
const codepipeline = require('aws-cdk-lib/aws-codepipeline');
const codepipeline_actions = require('aws-cdk-lib/aws-codepipeline-actions');

class ClineCdkSample2Stack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // S3バケットの作成
    const websiteBucket = new s3.Bucket(this, 'ReactWebsiteBucket', {
      removalPolicy: RemovalPolicy.DESTROY, // 開発環境用。本番環境では要検討
      autoDeleteObjects: true, // 開発環境用。本番環境では要検討
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // CloudFront OAIの作成
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OriginAccessIdentity', {
      comment: 'React Website OAI',
    });

    // CloudFront Distributionの作成
    const distribution = new cloudfront.Distribution(this, 'ReactWebsiteDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(30),
        },
      ],
    });

    // CodeCommitリポジトリの作成
    const repository = new codecommit.Repository(this, 'ReactAppRepository', {
      repositoryName: 'react-app-repository',
      description: 'Repository for React application',
    });

    // CodeBuildプロジェクトの作成
    const buildProject = new codebuild.PipelineProject(this, 'ReactBuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            commands: [
              'npm install',
            ],
          },
          build: {
            commands: [
              'npm run build',
            ],
          },
        },
        artifacts: {
          'base-directory': 'build',
          files: ['**/*'],
        },
      }),
    });

    // CodePipelineの作成
    const pipeline = new codepipeline.Pipeline(this, 'ReactAppPipeline', {
      pipelineName: 'ReactAppPipeline',
    });

    // ソースステージの追加
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'CodeCommit',
      repository: repository,
      output: sourceOutput,
      branch: 'main',
    });
    pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    // ビルドステージの追加
    const buildOutput = new codepipeline.Artifact();
    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'BuildAction',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });
    pipeline.addStage({
      stageName: 'Build',
      actions: [buildAction],
    });

    // デプロイステージの追加
    const deployAction = new codepipeline_actions.S3DeployAction({
      actionName: 'S3Deploy',
      input: buildOutput,
      bucket: websiteBucket,
      distribution: distribution,
      distributionPath: '/*',
    });
    pipeline.addStage({
      stageName: 'Deploy',
      actions: [deployAction],
    });

    // CloudFront Distributionのドメイン名を出力
    new CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
    });

    // CodeCommitリポジトリのCloneUrlを出力
    new CfnOutput(this, 'RepositoryCloneUrl', {
      value: repository.repositoryCloneUrlHttp,
    });
  }
}

module.exports = { ClineCdkSample2Stack }
