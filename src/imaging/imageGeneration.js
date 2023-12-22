const leonardo = require('api')('@leonardoai/v1.0#28807z41owlgnis8jg');
const axios = require('axios');
const checkAllImagesAvailability = require('../utils/helperFuncs');

async function generateImage(description) {
    console.log('Description:', description);

    try {
        const response = await axios.post('https://api.openai.com/v1/images/generations', {
            "model": "dall-e-3",
            "prompt": description,
            "n": 1,
            "size": "1024x1024"
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            }
        });

        console.log(response.data);

        // Extract the URL from the response data if it exists
        let imageUrls = response.data.data ? response.data.data.map(item => item.url) : [];
        console.log('Generated Image URLs:', imageUrls);

        // Return the image URLs along with an indication that the operation was successful (eta: 0)
        return { imageUrls, eta: 0 };
    } catch (error) {
        console.error("Error generating image:", error);
        // Return an empty array for imageUrls and an error indicator for eta
        return { imageUrls: [], eta: -1 };
    }
}

async function generateImageStableDiffusion(description) {
    console.log('Description:', description);

    try {
        const response = await axios.post('https://stablediffusionapi.com/api/v4/dreambooth', {
            "key": `${process.env.STABLE_DIFFUSION_KEY}`,
            "model_id": "realistic-vision-51",
            "prompt": description,
            "negative_prompt": "extra fingers, mutated hands, poorly drawn hands, poorly drawn face, deformed, ugly, blurry, bad anatomy, bad proportions, extra limbs, cloned face, skinny, glitchy, double torso, extra arms, extra hands, mangled fingers, missing lips, ugly face, distorted face, extra legs, robot eyes, bad teeth",
            "width": "512",
            "height": "512",
            "samples": "4",
            "num_inference_steps": "30",
            "safety_checker": "no",
            "enhance_prompt": "no",
            "seed": null,
            "guidance_scale": 7.5,
            "multi_lingual": "no",
            "panorama": "no",
            "self_attention": "no",
            "upscale": "no",
            "embeddings_model": null,
            "lora_model": null,
            "tomesd": "yes",
            "use_karras_sigmas": "yes",
            "vae": null,
            "lora_strength": null,
            "scheduler": "UniPCMultistepScheduler",
            "webhook": null,
            "track_id": null
        });


        console.log(response.data);

        let imageUrls = [];

        if (response.data.status === 'processing') {
            imageUrls = response.data.future_links;
            // Wait for all the images to be available
            await checkAllImagesAvailability(imageUrls);
            return { imageUrls, eta: response.data.eta };
        } else {
            return { imageUrls: response.data.output, eta: 0 };
        }
    } catch (error) {
        console.error("Error generating image:", error);
        return { imageUrls: [], eta: -1 };
    }
}

async function generateLeonardoImage(description) {
    console.log('Description:', description);

    try {
        // Authenticate with the SDK
        leonardo.auth(leonardo_ai_auth);

        // Create a generation
        const generationResponse = await leonardo.createGeneration({
            prompt: `${description}`,
            modelId: '291be633-cb24-434f-898f-e662799936ad',
            sd_version: 'v2',
            width: 512,
            height: 512,
            num_images: 4,
            promptMagic: true,
            negative_prompt: 'extra fingers, mutated hands, poorly drawn hands, poorly drawn face, deformed, ugly, blurry, bad anatomy, bad proportions, extra limbs, cloned face, skinny, glitchy, double torso, extra arms, extra hands, mangled fingers, missing lips, ugly face, distorted face, extra legs, easynegative (epicnegative:0.9) ng_deepnegative_v1_75t badhandv4, logos, brands, icons, text'
        });
        //console.log(generationResponse)
        const generationId = generationResponse.data.sdGenerationJob.generationId;

        // Re-authenticate if needed (remove this line if not necessary)
        leonardo.auth(leonardo_ai_auth);

        // Get the generation by ID
        const result = await getGenerationWhenComplete(generationId);
        console.log(result)
        const imageUrls = result.generations_by_pk.generated_images;
        console.log("Generated images:", imageUrls); // Log the generated URLs for debugging

        return imageUrls;
    } catch (error) {
        console.error("Error generating image:", error);
        return [];
    }
}

async function getGenerationWhenComplete(generationId, delay = 2000, maxAttempts = 20) {
    let attempts = 0;

    async function tryGetGeneration() {
        attempts++;

        if (attempts > maxAttempts) {
            throw new Error("Maximum attempts reached.");
        }

        // Assuming you're authenticating here
        leonardo.auth(leonardo_ai_auth);

        const response = await leonardo.getGenerationById({ id: generationId });
        if (response.data.generations_by_pk.status !== "PENDING") {
            return response.data;
        }

        // Wait for the delay duration and try again
        await new Promise(resolve => setTimeout(resolve, delay));
        return tryGetGeneration();
    }

    return tryGetGeneration();
}

module.exports = {
    generateImage,
    generateImageStableDiffusion,
    generateLeonardoImage
}