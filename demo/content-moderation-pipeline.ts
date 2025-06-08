// demo/content-moderation-pipeline.ts
// AI Content Moderation Pipeline using Cyre hooks family
// Demonstrates: data processing pipelines, AI integration, scalable content filtering

import {cyre, useCyre, useBranch, useGroup, schema, metrics} from '../src'

/**
 * 🤖 AI CONTENT MODERATION PIPELINE
 *
 * Architecture:
 * - Multi-stage content processing pipeline
 * - AI/ML integration for content analysis
 * - Human moderator workflows
 * - Real-time content filtering
 * - Appeals and review processes
 * - Multi-language support
 */

// ========================================
// CONTENT PROCESSING INFRASTRUCTURE
// ========================================

export const createContentProcessingInfrastructure = () => {
  // Main content moderation system
  const moderationSystem = useBranch({
    id: 'content-moderation',
    name: 'Content Moderation System'
  })

  // Content type processing branches
  const contentTypes = {
    text: moderationSystem.createChild({
      id: 'text-processing',
      name: 'Text Content Processing'
    }),
    image: moderationSystem.createChild({
      id: 'image-processing',
      name: 'Image Content Processing'
    }),
    video: moderationSystem.createChild({
      id: 'video-processing',
      name: 'Video Content Processing'
    }),
    audio: moderationSystem.createChild({
      id: 'audio-processing',
      name: 'Audio Content Processing'
    })
  }

  // AI model services
  const aiServices = moderationSystem.createChild({
    id: 'ai-services',
    name: 'AI Model Services'
  })
  const humanReview = moderationSystem.createChild({
    id: 'human-review',
    name: 'Human Review System'
  })
  const appeals = moderationSystem.createChild({
    id: 'appeals',
    name: 'Appeals Processing'
  })

  return {
    moderationSystem,
    contentTypes,
    aiServices,
    humanReview,
    appeals
  }
}

// ========================================
// AI CONTENT ANALYSIS SERVICES
// ========================================

export const createAIAnalysisServices = (infrastructure: any) => {
  const {aiServices} = infrastructure

  // Text analysis services
  const textAnalyzers = {
    toxicity: useCyre(
      {channelId: 'toxicity-detector', name: 'Toxicity Detection'},
      aiServices
    ),
    spam: useCyre(
      {channelId: 'spam-detector', name: 'Spam Detection'},
      aiServices
    ),
    sentiment: useCyre(
      {channelId: 'sentiment-analyzer', name: 'Sentiment Analysis'},
      aiServices
    ),
    language: useCyre(
      {channelId: 'language-detector', name: 'Language Detection'},
      aiServices
    ),
    profanity: useCyre(
      {channelId: 'profanity-filter', name: 'Profanity Filter'},
      aiServices
    )
  }

  // Image analysis services
  const imageAnalyzers = {
    nsfw: useCyre(
      {channelId: 'nsfw-detector', name: 'NSFW Content Detection'},
      aiServices
    ),
    violence: useCyre(
      {channelId: 'violence-detector', name: 'Violence Detection'},
      aiServices
    ),
    faces: useCyre(
      {channelId: 'face-detector', name: 'Face Detection'},
      aiServices
    ),
    objects: useCyre(
      {channelId: 'object-detector', name: 'Object Detection'},
      aiServices
    ),
    text_in_image: useCyre(
      {channelId: 'ocr-analyzer', name: 'Text in Image Analysis'},
      aiServices
    )
  }

  // Video analysis services
  const videoAnalyzers = {
    content_classification: useCyre(
      {channelId: 'video-classifier', name: 'Video Content Classification'},
      aiServices
    ),
    audio_extraction: useCyre(
      {channelId: 'audio-extractor', name: 'Audio Track Extraction'},
      aiServices
    ),
    scene_detection: useCyre(
      {channelId: 'scene-detector', name: 'Scene Change Detection'},
      aiServices
    )
  }

  // Set up text analyzers
  textAnalyzers.toxicity.on(content => {
    const toxicityScore = Math.random()
    const toxicityThreshold = 0.7

    return {
      contentId: content.contentId,
      text: content.text.substring(0, 100) + '...', // Truncate for logging
      toxicityScore,
      isToxic: toxicityScore > toxicityThreshold,
      confidence:
        toxicityScore > 0.8 ? 'high' : toxicityScore > 0.5 ? 'medium' : 'low',
      toxicityCategories:
        toxicityScore > toxicityThreshold
          ? ['harassment', 'hate_speech'].filter(() => Math.random() > 0.5)
          : [],
      timestamp: Date.now()
    }
  })

  textAnalyzers.spam.on(content => {
    const spamScore = Math.random()
    const hasLinks =
      content.text.includes('http') || content.text.includes('www.')
    const hasRepeatedChars = /(.)\1{4,}/.test(content.text)
    const hasExcessiveCaps =
      (content.text.match(/[A-Z]/g) || []).length / content.text.length > 0.7

    const adjustedScore =
      spamScore +
      (hasLinks ? 0.3 : 0) +
      (hasRepeatedChars ? 0.2 : 0) +
      (hasExcessiveCaps ? 0.2 : 0)

    return {
      contentId: content.contentId,
      spamScore: Math.min(adjustedScore, 1),
      isSpam: adjustedScore > 0.6,
      spamIndicators: {
        hasLinks,
        hasRepeatedChars,
        hasExcessiveCaps,
        length: content.text.length
      },
      confidence: adjustedScore > 0.8 ? 'high' : 'medium',
      timestamp: Date.now()
    }
  })

  textAnalyzers.sentiment.on(content => {
    const sentiment = ['positive', 'negative', 'neutral'][
      Math.floor(Math.random() * 3)
    ]
    const score = Math.random() * 2 - 1 // -1 to 1

    return {
      contentId: content.contentId,
      sentiment,
      sentimentScore: score,
      emotionalTone:
        Math.abs(score) > 0.7
          ? 'strong'
          : Math.abs(score) > 0.3
          ? 'moderate'
          : 'mild',
      language: content.language || 'en',
      timestamp: Date.now()
    }
  })

  // Set up image analyzers
  imageAnalyzers.nsfw.on(content => {
    const nsfwScore = Math.random()
    return {
      contentId: content.contentId,
      imageUrl: content.imageUrl,
      nsfwScore,
      isNSFW: nsfwScore > 0.8,
      nsfwCategories:
        nsfwScore > 0.8
          ? ['explicit', 'suggestive', 'partial_nudity'].filter(
              () => Math.random() > 0.6
            )
          : [],
      confidence: nsfwScore > 0.9 ? 'high' : nsfwScore > 0.7 ? 'medium' : 'low',
      timestamp: Date.now()
    }
  })

  imageAnalyzers.violence.on(content => {
    const violenceScore = Math.random()
    return {
      contentId: content.contentId,
      violenceScore,
      isViolent: violenceScore > 0.75,
      violenceTypes:
        violenceScore > 0.75
          ? ['weapons', 'fighting', 'blood'].filter(() => Math.random() > 0.7)
          : [],
      confidence: violenceScore > 0.85 ? 'high' : 'medium',
      timestamp: Date.now()
    }
  })

  // Set up video analyzers
  videoAnalyzers.content_classification.on(content => {
    const categories = [
      'educational',
      'entertainment',
      'news',
      'sports',
      'music',
      'gaming'
    ]
    const selectedCategories = categories.filter(() => Math.random() > 0.7)

    return {
      contentId: content.contentId,
      videoUrl: content.videoUrl,
      duration: content.duration || Math.floor(Math.random() * 600) + 30, // 30s to 10min
      categories: selectedCategories,
      primaryCategory: selectedCategories[0] || 'unknown',
      appropriateForMinors: Math.random() > 0.3,
      qualityScore: Math.random(),
      timestamp: Date.now()
    }
  })

  return {
    textAnalyzers,
    imageAnalyzers,
    videoAnalyzers
  }
}

// ========================================
// CONTENT PROCESSING PIPELINE
// ========================================

export const createContentPipeline = (infrastructure: any, aiServices: any) => {
  const {contentTypes} = infrastructure
  const {textAnalyzers, imageAnalyzers, videoAnalyzers} = aiServices

  // Text content pipeline
  const textPipeline = useCyre(
    {
      channelId: 'text-pipeline',
      name: 'Text Content Processing Pipeline'
    },
    contentTypes.text
  )

  textPipeline.on(async content => {
    try {
      // Run all text analysis in parallel
      const textAnalysisGroup = useGroup(Object.values(textAnalyzers), {
        name: 'Text Analysis Group',
        strategy: 'parallel',
        errorStrategy: 'continue'
      })

      const analysisResults = await textAnalysisGroup.call({
        contentId: content.contentId,
        text: content.text,
        language: content.language || 'en',
        userId: content.userId
      })

      if (!analysisResults.ok) {
        return {
          error: 'Text analysis failed',
          contentId: content.contentId,
          status: 'analysis_error'
        }
      }

      // Compile analysis results
      const analyses = analysisResults.payload.map((r: any) => r.payload)
      const toxicityResult = analyses.find(
        (a: any) => a.toxicityScore !== undefined
      )
      const spamResult = analyses.find((a: any) => a.spamScore !== undefined)
      const sentimentResult = analyses.find(
        (a: any) => a.sentiment !== undefined
      )

      // Make moderation decision
      let decision = 'approved'
      let confidence = 'high'
      let reasons = []

      if (toxicityResult?.isToxic) {
        decision = 'rejected'
        reasons.push(
          `Toxic content detected (${toxicityResult.toxicityScore.toFixed(2)})`
        )
      }

      if (spamResult?.isSpam) {
        decision = 'rejected'
        reasons.push(`Spam detected (${spamResult.spamScore.toFixed(2)})`)
      }

      // Flag for human review if borderline
      if (
        decision === 'approved' &&
        ((toxicityResult?.toxicityScore > 0.5 &&
          toxicityResult?.toxicityScore < 0.7) ||
          (spamResult?.spamScore > 0.4 && spamResult?.spamScore < 0.6))
      ) {
        decision = 'needs_review'
        confidence = 'medium'
        reasons.push('Borderline content requires human review')
      }

      return {
        contentId: content.contentId,
        contentType: 'text',
        decision,
        confidence,
        reasons,
        analyses: {
          toxicity: toxicityResult,
          spam: spamResult,
          sentiment: sentimentResult
        },
        processingTime: Date.now() - content.submittedAt,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        error: 'Text pipeline error',
        message: error instanceof Error ? error.message : String(error),
        contentId: content.contentId
      }
    }
  })

  // Image content pipeline
  const imagePipeline = useCyre(
    {
      channelId: 'image-pipeline',
      name: 'Image Content Processing Pipeline'
    },
    contentTypes.image
  )

  imagePipeline.on(async content => {
    try {
      const imageAnalysisGroup = useGroup(Object.values(imageAnalyzers), {
        name: 'Image Analysis Group',
        strategy: 'parallel',
        errorStrategy: 'continue'
      })

      const analysisResults = await imageAnalysisGroup.call({
        contentId: content.contentId,
        imageUrl: content.imageUrl,
        userId: content.userId
      })

      if (!analysisResults.ok) {
        return {
          error: 'Image analysis failed',
          contentId: content.contentId,
          status: 'analysis_error'
        }
      }

      const analyses = analysisResults.payload.map((r: any) => r.payload)
      const nsfwResult = analyses.find((a: any) => a.nsfwScore !== undefined)
      const violenceResult = analyses.find(
        (a: any) => a.violenceScore !== undefined
      )

      let decision = 'approved'
      let reasons = []

      if (nsfwResult?.isNSFW) {
        decision = 'rejected'
        reasons.push(
          `NSFW content detected (${nsfwResult.nsfwScore.toFixed(2)})`
        )
      }

      if (violenceResult?.isViolent) {
        decision = 'rejected'
        reasons.push(
          `Violent content detected (${violenceResult.violenceScore.toFixed(
            2
          )})`
        )
      }

      if (
        decision === 'approved' &&
        (nsfwResult?.nsfwScore > 0.6 || violenceResult?.violenceScore > 0.6)
      ) {
        decision = 'needs_review'
        reasons.push('Potentially inappropriate content requires review')
      }

      return {
        contentId: content.contentId,
        contentType: 'image',
        decision,
        reasons,
        analyses: {
          nsfw: nsfwResult,
          violence: violenceResult
        },
        processingTime: Date.now() - content.submittedAt,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        error: 'Image pipeline error',
        message: error instanceof Error ? error.message : String(error),
        contentId: content.contentId
      }
    }
  })

  // Video content pipeline
  const videoPipeline = useCyre(
    {
      channelId: 'video-pipeline',
      name: 'Video Content Processing Pipeline'
    },
    contentTypes.video
  )

  videoPipeline.on(async content => {
    try {
      // Video processing is more complex and sequential
      const videoAnalysisGroup = useGroup(Object.values(videoAnalyzers), {
        name: 'Video Analysis Group',
        strategy: 'sequential', // Sequential for video processing
        errorStrategy: 'continue'
      })

      const analysisResults = await videoAnalysisGroup.call({
        contentId: content.contentId,
        videoUrl: content.videoUrl,
        duration: content.duration,
        userId: content.userId
      })

      if (!analysisResults.ok) {
        return {
          error: 'Video analysis failed',
          contentId: content.contentId,
          status: 'analysis_error'
        }
      }

      const analyses = analysisResults.payload.map((r: any) => r.payload)
      const classificationResult = analyses.find(
        (a: any) => a.categories !== undefined
      )

      let decision = 'approved'
      let reasons = []

      // Video content decisions based on classification
      if (
        !classificationResult?.appropriateForMinors &&
        content.targetAudience === 'children'
      ) {
        decision = 'rejected'
        reasons.push('Content not appropriate for target audience')
      }

      if (classificationResult?.qualityScore < 0.3) {
        decision = 'needs_review'
        reasons.push('Low quality content requires review')
      }

      return {
        contentId: content.contentId,
        contentType: 'video',
        decision,
        reasons,
        analyses: {
          classification: classificationResult
        },
        processingTime: Date.now() - content.submittedAt,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        error: 'Video pipeline error',
        message: error instanceof Error ? error.message : String(error),
        contentId: content.contentId
      }
    }
  })

  return {
    textPipeline,
    imagePipeline,
    videoPipeline
  }
}

// ========================================
// HUMAN REVIEW SYSTEM
// ========================================

export const createHumanReviewSystem = (infrastructure: any) => {
  const {humanReview} = infrastructure

  // Human moderator workqueue
  const moderatorQueue = useCyre(
    {
      channelId: 'moderator-queue',
      name: 'Human Moderator Work Queue'
    },
    humanReview
  )

  // Review assignment system
  const reviewAssigner = useCyre(
    {
      channelId: 'review-assigner',
      name: 'Review Assignment System'
    },
    humanReview
  )

  // Quality assurance system
  const qualityAssurance = useCyre(
    {
      channelId: 'quality-assurance',
      name: 'Moderation Quality Assurance'
    },
    humanReview
  )

  moderatorQueue.on(queueRequest => {
    switch (queueRequest.type) {
      case 'get_pending_reviews':
        // Simulate pending reviews
        const pendingReviews = Array.from(
          {length: Math.floor(Math.random() * 20) + 5},
          (_, i) => ({
            contentId: `content-${Date.now()}-${i}`,
            contentType: ['text', 'image', 'video'][
              Math.floor(Math.random() * 3)
            ],
            priority: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
            submittedAt: Date.now() - Math.random() * 3600000, // Last hour
            aiDecision: 'needs_review',
            aiConfidence: Math.random(),
            flaggedReasons: [
              'Borderline content',
              'User report',
              'AI uncertainty'
            ]
          })
        )

        return {
          pendingCount: pendingReviews.length,
          reviews: pendingReviews.sort((a, b) => {
            const priorityOrder = {high: 3, medium: 2, low: 1}
            return priorityOrder[b.priority] - priorityOrder[a.priority]
          }),
          averageWaitTime: Math.floor(Math.random() * 30) + 10, // 10-40 minutes
          timestamp: Date.now()
        }

      case 'submit_review':
        const review = queueRequest.review
        return {
          reviewId: `review-${Date.now()}`,
          contentId: review.contentId,
          moderatorId: review.moderatorId,
          decision: review.decision,
          reasoning: review.reasoning,
          reviewTime: Math.floor(Math.random() * 300) + 60, // 1-5 minutes
          qualityScore: Math.random() * 0.3 + 0.7, // 0.7-1.0
          timestamp: Date.now()
        }

      default:
        return {error: 'Unknown queue request type'}
    }
  })

  reviewAssigner.on(assignmentRequest => {
    // Assign reviews to available moderators
    const availableModerators = Array.from({length: 8}, (_, i) => ({
      moderatorId: `mod-${i + 1}`,
      expertise: ['text', 'image', 'video'][Math.floor(Math.random() * 3)],
      currentWorkload: Math.floor(Math.random() * 10),
      qualityRating: Math.random() * 0.3 + 0.7,
      isOnline: Math.random() > 0.2 // 80% online
    })).filter(mod => mod.isOnline)

    const bestModerator = availableModerators
      .filter(
        mod =>
          mod.expertise === assignmentRequest.contentType ||
          assignmentRequest.contentType === 'any'
      )
      .sort(
        (a, b) =>
          a.currentWorkload -
          b.currentWorkload +
          (b.qualityRating - a.qualityRating)
      )[0]

    return {
      assignmentId: `assign-${Date.now()}`,
      contentId: assignmentRequest.contentId,
      assignedModerator: bestModerator,
      estimatedReviewTime: bestModerator
        ? Math.floor(bestModerator.currentWorkload * 5) + 120 // 2+ minutes base
        : null,
      queuePosition: bestModerator ? bestModerator.currentWorkload + 1 : null,
      timestamp: Date.now()
    }
  })

  qualityAssurance.on(qaRequest => {
    // Quality assurance on moderator decisions
    const decision = qaRequest.moderatorDecision
    const aiDecision = qaRequest.aiDecision

    // Check for consistency between AI and human decisions
    const isConsistent = decision.decision === aiDecision.decision
    const qualityScore = isConsistent
      ? Math.random() * 0.2 + 0.8 // 0.8-1.0 for consistent
      : Math.random() * 0.4 + 0.3 // 0.3-0.7 for inconsistent

    const needsSecondReview =
      !isConsistent && (decision.confidence === 'low' || Math.random() < 0.1)

    return {
      qaId: `qa-${Date.now()}`,
      contentId: qaRequest.contentId,
      moderatorId: qaRequest.moderatorId,
      qualityScore,
      isConsistent,
      needsSecondReview,
      qaRecommendations:
        qualityScore < 0.6
          ? [
              'Additional moderator training recommended',
              'Review moderation guidelines',
              'Escalate for supervisor review'
            ]
          : null,
      timestamp: Date.now()
    }
  })

  return {
    moderatorQueue,
    reviewAssigner,
    qualityAssurance
  }
}

// ========================================
// CONTENT MODERATION ORCHESTRATOR
// ========================================

export const createContentModerationOrchestrator = () => {
  const infrastructure = createContentProcessingInfrastructure()
  const aiServices = createAIAnalysisServices(infrastructure)
  const contentPipeline = createContentPipeline(infrastructure, aiServices)
  const humanReview = createHumanReviewSystem(infrastructure)

  // Master content coordinator
  const contentCoordinator = useCyre(
    {
      channelId: 'content-coordinator',
      name: 'Content Moderation Coordinator'
    },
    infrastructure.moderationSystem
  )

  contentCoordinator.on(async request => {
    try {
      switch (request.type) {
        case 'moderate_content':
          const content = request.content
          let pipelineResult

          // Route to appropriate pipeline
          switch (content.contentType) {
            case 'text':
              pipelineResult = await contentPipeline.textPipeline.call(content)
              break
            case 'image':
              pipelineResult = await contentPipeline.imagePipeline.call(content)
              break
            case 'video':
              pipelineResult = await contentPipeline.videoPipeline.call(content)
              break
            default:
              return {
                error: 'Unsupported content type',
                contentType: content.contentType
              }
          }

          if (!pipelineResult.ok) {
            return {
              error: 'Content processing failed',
              contentId: content.contentId
            }
          }

          // If needs human review, assign to moderator
          if (pipelineResult.payload.decision === 'needs_review') {
            const assignment = await humanReview.reviewAssigner.call({
              contentId: content.contentId,
              contentType: content.contentType,
              priority: content.priority || 'medium'
            })

            return {
              contentId: content.contentId,
              status: 'pending_review',
              aiDecision: pipelineResult.payload,
              humanReviewAssignment: assignment.payload,
              timestamp: Date.now()
            }
          }

          return {
            contentId: content.contentId,
            status: 'processed',
            decision: pipelineResult.payload.decision,
            aiDecision: pipelineResult.payload,
            timestamp: Date.now()
          }

        case 'get_moderation_stats':
          // Get comprehensive moderation statistics
          const queueStatus = await humanReview.moderatorQueue.call({
            type: 'get_pending_reviews'
          })

          return {
            type: 'moderation_statistics',
            humanReview: {
              pendingReviews: queueStatus.payload.pendingCount,
              averageWaitTime: queueStatus.payload.averageWaitTime
            },
            systemHealth: {
              aiServicesOperational: true, // Would check actual AI service health
              humanModeratorsOnline: Math.floor(Math.random() * 8) + 2,
              processingCapacity: Math.floor(Math.random() * 1000) + 500 // per hour
            },
            todayStats: {
              contentProcessed: Math.floor(Math.random() * 10000) + 5000,
              autoApproved: Math.floor(Math.random() * 3000) + 2000,
              autoRejected: Math.floor(Math.random() * 1000) + 500,
              humanReviewed: Math.floor(Math.random() * 500) + 200,
              appealsSubmitted: Math.floor(Math.random() * 50) + 10
            },
            timestamp: Date.now()
          }

        default:
          return {error: 'Unknown coordinator request type'}
      }
    } catch (error) {
      return {
        error: 'Content moderation coordinator error',
        message: error instanceof Error ? error.message : String(error)
      }
    }
  })

  return {
    infrastructure,
    aiServices,
    contentPipeline,
    humanReview,
    contentCoordinator,

    // Convenience methods
    async moderateContent(content: any) {
      return await contentCoordinator.call({
        type: 'moderate_content',
        content: {
          ...content,
          submittedAt: Date.now()
        }
      })
    },

    async getModerationStats() {
      return await contentCoordinator.call({
        type: 'get_moderation_stats'
      })
    }
  }
}

// ========================================
// USAGE EXAMPLE
// ========================================

export const contentModerationDemo = async () => {
  console.log('🤖 Initializing AI Content Moderation Pipeline...')

  const moderationSystem = createContentModerationOrchestrator()

  // Moderate text content
  console.log('\n📝 Moderating text content...')
  const textResult = await moderationSystem.moderateContent({
    contentId: 'text-001',
    contentType: 'text',
    text: 'This is a test message that might contain some questionable language or spam indicators!!!',
    userId: 'user-12345',
    priority: 'medium'
  })
  console.log('Text Moderation Result:', textResult)

  // Moderate image content
  console.log('\n🖼️ Moderating image content...')
  const imageResult = await moderationSystem.moderateContent({
    contentId: 'image-001',
    contentType: 'image',
    imageUrl: 'https://example.com/user-uploaded-image.jpg',
    userId: 'user-67890',
    priority: 'high'
  })
  console.log('Image Moderation Result:', imageResult)

  // Get moderation statistics
  console.log('\n📊 Getting moderation statistics...')
  const stats = await moderationSystem.getModerationStats()
  console.log('Moderation Statistics:', stats)

  return moderationSystem
}

export default contentModerationDemo()
