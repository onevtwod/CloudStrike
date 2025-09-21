import { RekognitionClient, DetectLabelsCommand, DetectTextCommand, DetectModerationLabelsCommand } from '@aws-sdk/client-rekognition';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const rekognition = new RekognitionClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoDb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));

interface ImageAnalysisResult {
    labels: Array<{
        name: string;
        confidence: number;
        categories?: Array<{
            name: string;
        }>;
    }>;
    text: Array<{
        text: string;
        confidence: number;
        boundingBox?: {
            left: number;
            top: number;
            width: number;
            height: number;
        };
    }>;
    moderation: Array<{
        name: string;
        confidence: number;
        parentName?: string;
    }>;
    disasterIndicators: {
        hasDisasterContent: boolean;
        confidence: number;
        indicators: string[];
    };
}

interface Event {
    eventId: string;
    imageUrl: string;
    s3Bucket?: string;
    s3Key?: string;
}

export const handler = async (event: Event): Promise<ImageAnalysisResult> => {
    console.log('Starting image analysis for event:', event.eventId);

    try {
        let imageBuffer: Buffer;

        // Get image from S3 or URL
        if (event.s3Bucket && event.s3Key) {
            imageBuffer = await getImageFromS3(event.s3Bucket, event.s3Key);
        } else {
            // For now, we'll assume the image is already in S3
            throw new Error('S3 bucket and key are required for image analysis');
        }

        // Analyze image with Rekognition
        const [labelsResult, textResult, moderationResult] = await Promise.all([
            detectLabels(imageBuffer),
            detectText(imageBuffer),
            detectModerationLabels(imageBuffer)
        ]);

        // Process results
        const analysisResult: ImageAnalysisResult = {
            labels: labelsResult.Labels || [],
            text: textResult.TextDetections?.map(detection => ({
                text: detection.DetectedText || '',
                confidence: detection.Confidence || 0,
                boundingBox: detection.Geometry?.BoundingBox ? {
                    left: detection.Geometry.BoundingBox.Left || 0,
                    top: detection.Geometry.BoundingBox.Top || 0,
                    width: detection.Geometry.BoundingBox.Width || 0,
                    height: detection.Geometry.BoundingBox.Height || 0
                } : undefined
            })) || [],
            moderation: moderationResult.ModerationLabels?.map(label => ({
                name: label.Name || '',
                confidence: label.Confidence || 0,
                parentName: label.ParentName
            })) || [],
            disasterIndicators: analyzeDisasterContent(labelsResult.Labels || [], textResult.TextDetections || [])
        };

        // Update event in DynamoDB with analysis results
        await updateEventWithImageAnalysis(event.eventId, analysisResult);

        console.log('Image analysis completed successfully');
        return analysisResult;

    } catch (error) {
        console.error('Error analyzing image:', error);
        throw error;
    }
};

async function getImageFromS3(bucket: string, key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
    });

    const response = await s3.send(command);

    if (!response.Body) {
        throw new Error('No image data found in S3');
    }

    const chunks: Uint8Array[] = [];
    const stream = response.Body as any;

    for await (const chunk of stream) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

async function detectLabels(imageBuffer: Buffer) {
    const command = new DetectLabelsCommand({
        Image: { Bytes: imageBuffer },
        MaxLabels: 20,
        MinConfidence: 70
    });

    return await rekognition.send(command);
}

async function detectText(imageBuffer: Buffer) {
    const command = new DetectTextCommand({
        Image: { Bytes: imageBuffer }
    });

    return await rekognition.send(command);
}

async function detectModerationLabels(imageBuffer: Buffer) {
    const command = new DetectModerationLabelsCommand({
        Image: { Bytes: imageBuffer },
        MinConfidence: 50
    });

    return await rekognition.send(command);
}

function analyzeDisasterContent(labels: any[], textDetections: any[]): {
    hasDisasterContent: boolean;
    confidence: number;
    indicators: string[];
} {
    const disasterKeywords = [
        'flood', 'fire', 'earthquake', 'hurricane', 'tornado', 'tsunami', 'avalanche',
        'landslide', 'drought', 'wildfire', 'storm', 'disaster', 'emergency', 'evacuation',
        'damage', 'destruction', 'rescue', 'emergency', 'alert', 'warning', 'danger'
    ];

    const disasterObjects = [
        'Fire', 'Smoke', 'Water', 'Flood', 'Storm', 'Cloud', 'Vehicle', 'Building',
        'Person', 'Crowd', 'Emergency', 'Rescue', 'Helicopter', 'Ambulance', 'Police'
    ];

    const indicators: string[] = [];
    let confidence = 0;
    let hasDisasterContent = false;

    // Check labels for disaster-related objects
    for (const label of labels) {
        if (label.Name && disasterObjects.includes(label.Name)) {
            indicators.push(`Object: ${label.Name} (${label.Confidence?.toFixed(1)}%)`);
            confidence += (label.Confidence || 0) * 0.3;
            hasDisasterContent = true;
        }
    }

    // Check text for disaster keywords
    for (const detection of textDetections) {
        const text = detection.DetectedText?.toLowerCase() || '';
        for (const keyword of disasterKeywords) {
            if (text.includes(keyword)) {
                indicators.push(`Text: "${detection.DetectedText}" contains "${keyword}"`);
                confidence += (detection.Confidence || 0) * 0.4;
                hasDisasterContent = true;
            }
        }
    }

    // Normalize confidence to 0-100
    confidence = Math.min(confidence, 100);

    return {
        hasDisasterContent,
        confidence,
        indicators
    };
}

async function updateEventWithImageAnalysis(eventId: string, analysis: ImageAnalysisResult) {
    const command = new UpdateCommand({
        TableName: process.env.EVENTS_TABLE,
        Key: { id: eventId },
        UpdateExpression: 'SET imageAnalysis = :analysis, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
            ':analysis': analysis,
            ':updatedAt': new Date().toISOString()
        }
    });

    await dynamoDb.send(command);
}
