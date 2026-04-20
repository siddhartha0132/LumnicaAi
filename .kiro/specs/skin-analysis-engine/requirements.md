# Requirements Document

## Introduction

The Skin Analysis Engine is the foundational component of LUMNICA AI that analyzes facial photographs using Google Gemini Vision Pro to produce structured, clinical-grade skin assessments. This engine determines skin characteristics including Fitzpatrick type, undertone, oiliness patterns, texture quality, visible concerns, and estimated skin age. The accuracy of this analysis directly impacts all downstream personalization features in the application.

## Glossary

- **Skin_Analysis_Engine**: The backend service that processes facial images and returns structured skin assessment data
- **Image_Validator**: The component that validates uploaded image files for format, size, and type compliance
- **Gemini_Vision_Client**: The service interface that communicates with Google Gemini Vision Pro API
- **Analysis_Response**: The structured JSON object containing complete skin assessment data
- **Confidence_Score**: A numerical value between 0.0 and 1.0 indicating the reliability of the analysis
- **Fitzpatrick_Scale**: A numerical classification system (Types I-VI) for human skin color
- **T_Zone**: The forehead and nose area of the face, typically more oily than other regions
- **Base64_Encoder**: The component that converts image binary data to base64 string format
- **Concern_Array**: An ordered list of skin issues detected, sorted by severity (most severe first)

## Requirements

### Requirement 1: Image Upload Acceptance

**User Story:** As a user, I want to upload my facial photo, so that the system can analyze my skin characteristics.

#### Acceptance Criteria

1. THE Image_Validator SHALL accept multipart/form-data requests with field name "image"
2. THE Image_Validator SHALL accept files with MIME type image/jpeg
3. THE Image_Validator SHALL accept files with MIME type image/png
4. THE Image_Validator SHALL reject files exceeding 10MB in size
5. WHEN the uploaded file does not exist, THE Image_Validator SHALL return HTTP 400 with error message "Invalid image" and detail explanation
6. WHEN the uploaded file format is not image/jpeg or image/png, THE Image_Validator SHALL return HTTP 400 with error message "Invalid image" and detail explanation

### Requirement 2: Image Format Conversion

**User Story:** As a system, I want to convert validated images to base64 format, so that they can be transmitted to the Gemini Vision API.

#### Acceptance Criteria

1. WHEN an image passes validation, THE Base64_Encoder SHALL convert the image binary data to base64 string format
2. THE Base64_Encoder SHALL preserve the original MIME type metadata during conversion
3. THE Base64_Encoder SHALL complete conversion before initiating the Gemini Vision API call

### Requirement 3: Gemini Vision Prompt Construction

**User Story:** As a system, I want to send a precise analysis prompt to Gemini Vision, so that I receive structured and clinically accurate skin assessment data.

#### Acceptance Criteria

1. THE Gemini_Vision_Client SHALL declare the AI role as "clinical-grade AI dermatologist and Ayurvedic skin expert"
2. THE Gemini_Vision_Client SHALL request Fitzpatrick scale classification with types I through VI
3. THE Gemini_Vision_Client SHALL request undertone classification as warm, cool, neutral, or olive
4. THE Gemini_Vision_Client SHALL request oiliness assessment separately for T_Zone and cheeks
5. THE Gemini_Vision_Client SHALL request pore size classification as small, medium, enlarged, or very enlarged
6. THE Gemini_Vision_Client SHALL request texture assessment as smooth, slightly uneven, uneven, or rough
7. THE Gemini_Vision_Client SHALL request acne severity classification as none, mild, moderate, or severe
8. THE Gemini_Vision_Client SHALL request concerns as an array sorted by severity with most severe first
9. THE Gemini_Vision_Client SHALL request estimated skin age as a range in years
10. THE Gemini_Vision_Client SHALL request a Confidence_Score between 0.0 and 1.0 with notes for poor image quality
11. THE Gemini_Vision_Client SHALL instruct the model to return only valid JSON without markdown formatting or preamble text
12. THE Gemini_Vision_Client SHALL exclude example skin types from the prompt to prevent model bias
13. THE Gemini_Vision_Client SHALL exclude predefined concern lists from the prompt to allow free detection

### Requirement 4: Response Schema Validation

**User Story:** As a developer, I want the analysis response to match a defined schema, so that downstream components can reliably process the data.

#### Acceptance Criteria

1. THE Analysis_Response SHALL contain a fitzpatrick object with type, tone, undertone, and hexRange fields
2. THE Analysis_Response SHALL contain an oiliness object with overall, tZone, cheeks, and poreSize fields
3. THE Analysis_Response SHALL contain a texture object with overall, acne, and surfaceIrregularities fields
4. THE Analysis_Response SHALL contain a concerns array with objects containing name and severity fields
5. THE Analysis_Response SHALL contain a skinAge object with estimatedRange, agingSigns, and agingDetails fields
6. THE Analysis_Response SHALL contain a confidence object with score and notes fields
7. THE Concern_Array SHALL be sorted with the most severe concern first

### Requirement 5: Analysis Error Handling

**User Story:** As a system operator, I want robust error handling for analysis failures, so that the service remains stable and provides useful feedback.

#### Acceptance Criteria

1. WHEN Gemini Vision returns unparseable JSON, THE Skin_Analysis_Engine SHALL return HTTP 422 with error message "Analysis failed" and include the raw response
2. WHEN the Confidence_Score is less than 0.5, THE Skin_Analysis_Engine SHALL include a warning message "Low confidence — image may be blurry or poorly lit" in the response
3. THE Skin_Analysis_Engine SHALL wrap all Gemini Vision API calls in try-catch blocks
4. WHEN an exception occurs during analysis, THE Skin_Analysis_Engine SHALL log the error and return an appropriate HTTP error response
5. THE Skin_Analysis_Engine SHALL prevent server crashes from propagating from failed analysis requests

### Requirement 6: Response Data Integrity

**User Story:** As a product owner, I want all analysis data to be model-generated, so that results remain unbiased and reflect actual AI assessment.

#### Acceptance Criteria

1. THE Skin_Analysis_Engine SHALL NOT post-process the Concern_Array returned by Gemini Vision
2. THE Skin_Analysis_Engine SHALL NOT filter concerns based on predefined lists
3. THE Skin_Analysis_Engine SHALL NOT inject hardcoded skin assessment data into the Analysis_Response
4. THE Skin_Analysis_Engine SHALL return the Gemini Vision output without modification except for schema validation

### Requirement 7: Analysis Response Parser

**User Story:** As a system, I want to parse Gemini Vision responses reliably, so that I can extract valid JSON even when the model includes extra formatting.

#### Acceptance Criteria

1. WHEN Gemini Vision returns JSON wrapped in markdown code fences, THE Skin_Analysis_Engine SHALL extract the JSON content
2. WHEN Gemini Vision returns JSON with preamble text, THE Skin_Analysis_Engine SHALL extract the JSON object
3. WHEN no valid JSON object is found in the response, THE Skin_Analysis_Engine SHALL return HTTP 422 with error details
4. THE Skin_Analysis_Engine SHALL parse the extracted JSON and validate it against the expected schema
