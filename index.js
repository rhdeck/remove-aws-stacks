const { S3, CloudFormation } = require("aws-sdk");
const commander = require("commander");
commander.option(
  "-r --region <region>",
  "AWS Region",
  process.env["AWS_REGION"] || "us-east-1"
);
commander.command("list").action(async ({ parent: { region } }) => {
  const s3 = new S3({ region });
  const { Buckets } = await s3.listBuckets().promise();
  const prefixes = Buckets.map(({ Name }) => Name.split("-").shift());
  const prefixesset = new Set(prefixes);
  const prefixesunique = Array.from(prefixesset);
  console.log(JSON.stringify(prefixesunique, null, 2));
});
commander
  .command("delete <prefix>")
  .action(async (prefix, { parent: { region } }) => {
    const s3 = new S3({ region });
    const cf = new CloudFormation({ region });

    console.log("I should kill prefix", prefix);
    const start = Date.now();
    const { Buckets } = await s3.listBuckets().promise();
    const tokill = Buckets.filter(({ Name }) =>
      Name.startsWith(prefix + "-")
    ).map(({ Name }) => Name);
    for (const Bucket of tokill) {
      const { Contents } = await s3.listObjects({ Bucket }).promise();
      for (const { Key } of Contents) {
        console.log("WIll delete ", Bucket, Key);
        await s3.deleteObject({ Bucket, Key }).promise();
      }
      console.log("Will delete bucket", Bucket);
      await s3.deleteBucket({ Bucket });
    }
    const allSS = [];
    let NextToken = null;
    do {
      const { StackSummaries, NextToken: nt } = await cf
        .listStacks({ NextToken })
        .promise();
      allSS.push(...StackSummaries);
      NextToken = nt;
    } while (NextToken);
    const toKill = allSS.filter(({ StackName }) =>
      StackName.startsWith(prefix + "-")
    );
    console.log("I will get rid of these stacks", toKill);
    for (const { StackName } of toKill) {
      console.log("Starting remove of ", StackName);
      const output = await cf.deleteStack({ StackName }).promise();
      console.log("output for deleting " + StackName + " is ", output);
    }
    console.log("Finished as of", new Date(Date.now()).toISOString());
    const duration = Date.now() - start;
    console.log("Took ms: ", duration);
  });
commander.parse(process.argv);
/*
const doitall = async () => {
  console.log("Starting now", new Date(Date.now()).toISOString());
  const start = Date.now();
  const { Buckets } = await s3.listBuckets().promise();
  const prefixes = new Set(Buckets.map(({ Name }) => Name.split("-").shift()));
  console.log("prefixes are", prefixes);
  const tokill = Buckets.filter(({ Name }) =>
    Name.startsWith(prefix + "-")
  ).map(({ Name }) => Name);
  console.log(tokill);
  for (const Bucket of tokill) {
    const { Contents } = await s3.listObjects({ Bucket }).promise();
    for (const { Key } of Contents) {
      console.log("WIll delete ", Bucket, Key);
      await s3.deleteObject({ Bucket, Key }).promise();
    }
    console.log("Will delete bucket", Bucket);
    await s3.deleteBucket({ Bucket });
  }
  const allSS = [];
  let NextToken = null;
  do {
    const { StackSummaries, NextToken: nt, ...rest } = await cf
      .listStacks({ NextToken })
      .promise();
    allSS.push(...StackSummaries);
    NextToken = nt;
  } while (NextToken);
  //   console.log("rest is", rest);
  const toKill = allSS.filter(({ StackName }) =>
    StackName.startsWith(prefix + "-")
  );
  console.log("I will get rid of these stacks", toKill);
  for (const { StackName } of toKill) {
    const output = await cf.deleteStack({ StackName }).promise();
    console.log("output for deleting " + StackName + " is ", output);
  }
  console.log("Finished as of", new Date(Date.now()).toISOString());
  const duration = Date.now() - start;
  console.log("Took ms: ", duration);
};

*/
