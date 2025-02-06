const { Stack, Duration, RemovalPolicy, CfnOutput } = require('aws-cdk-lib');
const s3 = require('aws-cdk-lib/aws-s3');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const codecommit = require('aws-cdk-lib/aws-codecommit');
const codebuild = require('aws-cdk-lib/aws-codebuild');
const codepipeline = require('aws-cdk-lib/aws-codepipeline');
const codepipeline_actions = require('aws-cdk-lib/aws-codepipeline-actions');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const iam = require('aws-cdk-lib/aws-iam');

class ClineCdkSample3Stack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // DynamoDBテーブルの作成
    const tasksTable = new dynamodb.Table(this, 'TasksTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // 開発環境用。本番環境では要検討
    });

    // Lambda関数用のIAMロールの作成
    const lambdaRole = new iam.Role(this, 'TasksLambdaRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('lambda.amazonaws.com'),
        new iam.ServicePrincipal('edgelambda.amazonaws.com')
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    // DynamoDB操作用のポリシーを追加
    tasksTable.grantReadWriteData(lambdaRole);

    // Lambda関数の作成
    const tasksFunction = new lambda.Function(this, 'TasksFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          const { httpMethod, path, body } = event;
          const AWS = require('aws-sdk');
          const dynamodb = new AWS.DynamoDB.DocumentClient();
          const tableName = process.env.TABLE_NAME;
          
          try {
            switch(httpMethod) {
              case 'GET':
                if (path.includes('/tasks/')) {
                  const id = path.split('/').pop();
                  const result = await dynamodb.get({
                    TableName: tableName,
                    Key: { id }
                  }).promise();
                  return {
                    statusCode: 200,
                    body: JSON.stringify(result.Item)
                  };
                } else {
                  const result = await dynamodb.scan({
                    TableName: tableName
                  }).promise();
                  return {
                    statusCode: 200,
                    body: JSON.stringify(result.Items)
                  };
                }
              case 'POST':
                const item = JSON.parse(body);
                await dynamodb.put({
                  TableName: tableName,
                  Item: item
                }).promise();
                return {
                  statusCode: 201,
                  body: JSON.stringify(item)
                };
              case 'PUT':
                const updateItem = JSON.parse(body);
                await dynamodb.update({
                  TableName: tableName,
                  Key: { id: updateItem.id },
                  UpdateExpression: 'set #title = :title, #description = :description',
                  ExpressionAttributeNames: {
                    '#title': 'title',
                    '#description': 'description'
                  },
                  ExpressionAttributeValues: {
                    ':title': updateItem.title,
                    ':description': updateItem.description
                  }
                }).promise();
                return {
                  statusCode: 200,
                  body: JSON.stringify(updateItem)
                };
              case 'DELETE':
                const deleteId = path.split('/').pop();
                await dynamodb.delete({
                  TableName: tableName,
                  Key: { id: deleteId }
                }).promise();
                return {
                  statusCode: 204
                };
              default:
                return {
                  statusCode: 405,
                  body: 'Method Not Allowed'
                };
            }
          } catch (error) {
            return {
              statusCode: 500,
              body: JSON.stringify({ error: error.message })
            };
          }
        };
      `),
      role: lambdaRole,
      environment: {
        TABLE_NAME: tasksTable.tableName
      }
    });

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
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(`${tasksFunction.functionName}.lambda-url.${this.region}.amazonaws.com`, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        }
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

    // 出力の設定
    new CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
    });

    new CfnOutput(this, 'RepositoryCloneUrl', {
      value: repository.repositoryCloneUrlHttp,
    });

    new CfnOutput(this, 'DynamoDBTableName', {
      value: tasksTable.tableName,
    });

    new CfnOutput(this, 'LambdaFunctionName', {
      value: tasksFunction.functionName,
    });
  }
}

module.exports = { ClineCdkSample3Stack }
