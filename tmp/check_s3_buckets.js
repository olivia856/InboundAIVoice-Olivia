
const { createClient } = require('@supabase/supabase-js');
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

const SUPABASE_URL = 'https://qhqmljwexivhvxzfklum.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFocW1sandleGl2aHZ4emZrbHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTM3MjMsImV4cCI6MjA5MDM2OTcyM30.nO_aKJkRRsDNSIWDLgmvos7LxISvenFz2Fwn-62BgLo';

async function checkS3() {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        const { data: awsInt, error } = await supabase.from('integrations').select('*').eq('provider', 'aws_s3').maybeSingle();
        
        if (error || !awsInt) {
            console.log("AWS Integration not found in database.");
            return;
        }

        const accessKeyId = awsInt.meta_data.access_key;
        const secretAccessKey = awsInt.api_key;
        const region = awsInt.meta_data.region || 'us-east-1';

        console.log(`Checking S3 for Access Key: ${accessKeyId} in region ${region}...`);

        const s3 = new S3Client({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey
            }
        });

        const response = await s3.send(new ListBucketsCommand({}));
        console.log("\n--- AVAILABLE S3 BUCKETS ---");
        response.Buckets.forEach(b => console.log(`- ${b.Name}`));
        console.log("----------------------------\n");

    } catch (err) {
        console.error("Error checking S3:", err.message);
    }
}

checkS3();
