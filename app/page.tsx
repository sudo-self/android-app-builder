"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Globe, Moon, Sun, Download, RefreshCw, Github, Copy, Key, Palette, AlertCircle, Image } from "lucide-react"

const GITHUB_OWNER = 'sudo-self'
const GITHUB_REPO = 'apk-builder-actions'

interface BuildData {
  buildId: string
  hostName: string
  launchUrl: string
  name: string
  launcherName: string
  themeColor: string
  themeColorDark: string
  backgroundColor: string
  iconChoice: string
}

interface BuildStatus {
  status: 'pending' | 'success' | 'failed' | 'unknown'
  artifactUrl?: string
}

const ICON_CHOICES = [
  {
    value: "phone",
    label: "Phone Icon",
    url: "https://apk.jessejesse.com/phone-512.png"
  },
  {
    value: "castle",
    label: "Castle Icon", 
    url: "https://apk.jessejesse.com/castle-512.png"
  },
  {
    value: "smile",
    label: "Smile Icon",
    url: "https://apk.jessejesse.com/smile-512.png"
  }
]

export default function APKBuilder() {
  const [url, setUrl] = useState("")
  const [appName, setAppName] = useState("")
  const [hostName, setHostName] = useState("")
  const [themeColor, setThemeColor] = useState("#171717")
  const [themeColorDark, setThemeColorDark] = useState("#000000")
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF")
  const [iconChoice, setIconChoice] = useState("phone")
  const [isComplete, setIsComplete] = useState(false)
  const [isBuilding, setIsBuilding] = useState(false)
  const [terminalLogs, setTerminalLogs] = useState<string[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [showBootScreen, setShowBootScreen] = useState(true)
  const [buildId, setBuildId] = useState<string | null>(null)
  const [githubRunId, setGithubRunId] = useState<string | null>(null)
  const [artifactUrl, setArtifactUrl] = useState<string | null>(null)
  const [buildStartTime, setBuildStartTime] = useState<number>(0)
  const [showAppKey, setShowAppKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getGitHubToken = (): string | null => {
    if (typeof window === 'undefined') return null
    
    const token = 
      process.env.NEXT_PUBLIC_GITHUB_TOKEN ||
      (window as any).ENV?.NEXT_PUBLIC_GITHUB_TOKEN ||
      localStorage.getItem('github_token')
    
    return token || null
  }

  const hasGitHubToken = !!getGitHubToken()

  useEffect(() => {
    if (url) {
      try {
        const urlObj = new URL(url)
        const extractedHost = urlObj.hostname
        setHostName(extractedHost)
        if (!appName) {
          const defaultName = extractedHost.replace(/^www\./, '').split('.')[0]
          setAppName(defaultName.charAt(0).toUpperCase() + defaultName.slice(1))
        }
        setError(null)
      } catch (e) {
        setHostName("")
        if (url) {
          setError("Please enter a valid URL with http:// or https://")
        }
      }
    } else {
      setHostName("")
      setError(null)
    }
  }, [url, appName])

  useEffect(() => {
    const bootTimer = setTimeout(() => {
      setShowBootScreen(false)
    }, 3000)
    return () => clearTimeout(bootTimer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isBuilding || !githubRunId) return

    let pollCount = 0
    const maxPolls = 120

    const pollBuildStatus = async () => {
      if (pollCount >= maxPolls) {
        setTerminalLogs(prev => [...prev, "Build timeout - check GitHub Actions for status"])
        setIsBuilding(false)
        return
      }

      pollCount++

      try {
        const result = await checkBuildStatus(githubRunId)
        
        if (result.status === 'success') {
          setTerminalLogs(prev => [...prev, "Build completed", "APK is ready"])
          setIsBuilding(false)
          setIsComplete(true)
          
          if (result.artifactUrl) {
            setArtifactUrl(result.artifactUrl)
          }
        } else if (result.status === 'failed') {
          setTerminalLogs(prev => [...prev, "Build failed. Check GitHub Actions for details"])
          setIsBuilding(false)
        } else {
          const elapsedMinutes = Math.floor((Date.now() - buildStartTime) / 60000)
          if (pollCount % 6 === 0) {
            setTerminalLogs(prev => [...prev, `building... (${elapsedMinutes}m elapsed)`])
          }
          setTimeout(pollBuildStatus, 5000)
        }
      } catch (error) {
        console.error('Error polling GitHub status:', error)
        setTimeout(pollBuildStatus, 5000)
      }
    }

    pollBuildStatus()

    return () => {
      pollCount = maxPolls
    }
  }, [isBuilding, githubRunId, buildStartTime])

  const checkBuildStatus = async (runId: string): Promise<BuildStatus> => {
    const token = getGitHubToken()
    if (!token) {
      throw new Error('GitHub token not configured')
    }
    
    try {
      const runResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${runId}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      )
      
      if (!runResponse.ok) {
        throw new Error(`GitHub API error: ${runResponse.status}`)
      }
      
      const runData = await runResponse.json()
      
      if (runData.status === 'completed') {
        if (runData.conclusion === 'success') {
          const artifactsResponse = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${runId}/artifacts`,
            {
              headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            }
          )
          
          if (artifactsResponse.ok) {
            const artifactsData = await artifactsResponse.json()
            if (artifactsData.artifacts && artifactsData.artifacts.length > 0) {
              const artifactDownloadUrl = artifactsData.artifacts[0].archive_download_url
              return { 
                status: 'success', 
                artifactUrl: artifactDownloadUrl 
              }
            }
          }
          
          return { status: 'success' }
        } else {
          return { status: 'failed' }
        }
      }
      
      return { status: 'pending' }
    } catch (error) {
      console.error('Error checking build status:', error)
      throw error
    }
  }
      
  const validateWebsite = async (url: string): Promise<boolean> => {
    try {
      const urlObj = new URL(url)
      return !!(urlObj.hostname && urlObj.protocol.startsWith('http') && urlObj.hostname.includes('.'))
    } catch (e) {
      return false
    }
  }

  const triggerGitHubAction = async (buildData: BuildData): Promise<string | null> => {
    const token = getGitHubToken()
    if (!token) {
      throw new Error('GitHub token not configured. Please check your environment variables.')
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            event_type: 'apk_build',
            client_payload: buildData
          })
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        if (response.status === 404) {
          throw new Error('GitHub repository not found or access denied')
        } else if (response.status === 403) {
          throw new Error('GitHub token invalid or missing permissions')
        } else {
          throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`)
        }
      }

      await new Promise(resolve => setTimeout(resolve, 5000))

      const runsResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs?event=repository_dispatch&per_page=10`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      )

      if (runsResponse.ok) {
        const runsData = await runsResponse.json()
        if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
          const recentRun = runsData.workflow_runs[0]
          return recentRun.id.toString()
        }
      }

      return null

    } catch (error) {
      console.error('Error triggering GitHub action:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!getGitHubToken()) {
      setError('GitHub token not configured. Please check your environment setup.')
      return
    }
    
    if (url && appName && hostName) {
      const isValidWebsite = await validateWebsite(url)
      if (!isValidWebsite) {
        setError("Invalid website URL format. Please include http:// or https:// and a valid domain.")
        return
      }

      setIsBuilding(true)
      setError(null)
      setTerminalLogs([])
      setGithubRunId(null)
      setArtifactUrl(null)
      setBuildStartTime(Date.now())
      setShowAppKey(false)

      try {
        const buildId = `build_${Date.now()}`
        setBuildId(buildId)

        const cleanHostName = url
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/$/, '')
        
        const buildData: BuildData = {
          buildId,
          hostName: cleanHostName,
          launchUrl: '/',
          name: appName,
          launcherName: appName,
          themeColor: themeColor,
          themeColorDark: themeColorDark,
          backgroundColor: backgroundColor,
          iconChoice: iconChoice
        }
        
        setTerminalLogs([
          "building apk...",
          `App: ${appName}`,
          `Host: ${cleanHostName}`,
          `Theme: ${themeColor}`,
          `Icon: ${iconChoice}`,
          `ID: ${buildId}`,
          "in progress...",
          ""
        ])

        const runId = await triggerGitHubAction(buildData)
        
        if (runId) {
          setGithubRunId(runId)
          setTerminalLogs(prev => [
            ...prev,
            `GitHub Actions`,
            `Run ID: ${runId}`,
            "build in progress",
            "creating artifact",
            ""
          ])
        } else {
          throw new Error('Failed to get GitHub Actions run ID. The build may have started - check GitHub Actions.')
        }

      } catch (error: any) {
        console.error('Build error:', error)
        const errorMessage = error.message || 'Unknown error occurred'
        setTerminalLogs(prev => [...prev, `Build failed: ${errorMessage}`])
        setError(errorMessage)
        setIsBuilding(false)
      }
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const downloadAPK = async () => {
    if (artifactUrl) {
      window.open(artifactUrl, '_blank')
    } else if (githubRunId) {
      window.open(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${githubRunId}`, '_blank')
    }
  }

  const copyAppKey = async () => {
    const keyInfo = `Alias: android\nPassword: 123321\n\nYou will need this key to publish changes to your app.`
    
    try {
      await navigator.clipboard.writeText(keyInfo)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      const textArea = document.createElement('textarea')
      textArea.value = keyInfo
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const resetForm = () => {
    setIsComplete(false)
    setIsBuilding(false)
    setUrl("")
    setAppName("")
    setHostName("")
    setThemeColor("#171717")
    setThemeColorDark("#000000")
    setBackgroundColor("#FFFFFF")
    setIconChoice("phone")
    setTerminalLogs([])
    setBuildId(null)
    setGithubRunId(null)
    setArtifactUrl(null)
    setBuildStartTime(0)
    setShowAppKey(false)
    setCopied(false)
    setShowAdvanced(false)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div 
          className="relative mx-auto w-[340px] h-[680px] bg-black rounded-[3rem] shadow-2xl border-8 border-transparent overflow-hidden p-0.5"
          style={{
            backgroundImage: 'linear-gradient(black, black), linear-gradient(to bottom, #6b7280, #7e22ce, #3b82f6, #06b6d4)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'content-box, border-box',
            backgroundSize: '100% 100%'
          }}
        >
          {error && !isBuilding && (
            <div className="absolute top-4 left-4 right-4 bg-red-500 text-white p-3 rounded-lg z-20 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}
          
          {!hasGitHubToken && (
            <div className="absolute top-4 left-4 right-4 bg-yellow-500 text-white p-3 rounded-lg z-20 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">GitHub token not configured</span>
              </div>
            </div>
          )}

          <div className={`absolute inset-[6px] rounded-[2.5rem] overflow-hidden transition-colors ${
            isDarkMode ? "bg-black" : "bg-gradient-to-b from-slate-50 to-slate-100"
          }`}>     
            {showBootScreen ? (
              <div className="h-full bg-black flex flex-col items-center justify-center rounded-[2.5rem]">
                <div className="animate-in fade-in zoom-in duration-1000">
                  <img 
                    src="./droiddroid.svg" 
                    alt="Android Logo"
                    className="w-28 h-28 mb-8"
                  />
                </div>
                <div className="flex gap-2 mb-4">
                  <div className="w-3 h-3 bg-[#3DDC84] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-3 h-3 bg-[#3DDC84] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-3 h-3 bg-[#3DDC84] rounded-full animate-bounce" />
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[#3DDC84] text-md font-medium animate-pulse">A N D R O I D</p>
                </div>
              </div>
            ) : (
              <>
                <div className={`h-12 flex items-center justify-between px-8 text-xs rounded-t-[2.5rem] ${
                  isDarkMode ? "bg-slate-950 text-white" : "bg-slate-900 text-white"
                }`}>
                  <div className="flex items-center gap-3 text-[#3DDC84]">
                    <span className="font-semibold">{formatTime(currentTime)}</span>
                    <span className="opacity-80">{formatDate(currentTime)}</span>
                  </div>
                  <div className="flex gap-3 items-center text-[#3DDC84]">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.5 11.5 0 0 0-8.94 0L5.65 5.67c-.19-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85l1.84 3.18C4.8 11.16 3.5 13.84 3.5 16.5V19h17v-2.5c0-2.66-1.3-5.34-2.9-7.02zM7 17.25c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75z" />
                    </svg>
                    <button
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className="hover:opacity-70 transition-opacity"
                      aria-label="Toggle theme"
                    >
                      {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="h-[calc(100%-3rem-24px)] overflow-y-auto p-6">
                  {isBuilding || isComplete ? (
                    <div className="h-full bg-black rounded-xl p-4 overflow-y-auto font-mono">
                      <div className="flex items-center gap-2 mb-4 text-green-400 text-sm">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="ml-2">Command Line</span>
                      </div>

                      <div className="space-y-2">
                        {terminalLogs.map((log, index) => (
                          <div key={index} className="text-green-400 text-sm animate-in fade-in slide-in-from-left-2">
                            <span className="text-cyan-600 mr-2">$</span> {log}
                          </div>
                        ))}
                        
                        {isBuilding && (
                          <div className="flex items-center gap-2 text-green-400 text-sm">
                            <span className="text-green-600">$</span>
                            <div className="flex gap-1">
                              <div className="w-1 h-3 bg-gray-400 rounded-full animate-pulse"></div>
                              <div className="w-1 h-3 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-1 h-3 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                            <span>_</span>
                          </div>
                        )}

                        {isComplete && (
                          <div className="mt-4 pt-4 border-t border-slate-700">
                            <Button
                              onClick={downloadAPK}
                              className="w-full bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download APK
                            </Button>
                          </div>
                        )}

                        {githubRunId && (
                          <div className="text-gray-400 text-xs text-center mt-4 pt-2 border-t border-slate-700">
                            <a 
                              href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${githubRunId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:no-underline hover:text-blue-400"
                            >
                              View live build on Github
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl mb-3 shadow-lg">
                          <svg 
                            className="w-8 h-8 text-white" 
                            viewBox="0 0 512 470.647"
                            fill="currentColor"
                          >
                            <polygon points="235.793 0 143.978 137.674 143.978 224.949 87.702 224.949 87.702 137.674 0 0 63.25 0 119.018 88.646 175.243 0 235.793 0 235.793 0" />
                            <path d="M330.294,175.451h-101.861l-20.717,50.024h-45.106l95.38,-224.949h46.137l91.51,224.949h-48.2l-17.144,-50.024zm-16.92,-44.911l-31.226,-82.55l-34.837,82.55h66.063z" />
                            <polygon points="87.701 250.177 87.701 470.647 135.004 470.647 135.004 318.569 184.509 420.789 221.743 420.789 272.939 314.976 272.939 470.602 318.318 470.602 318.318 250.177 256.358 250.177 201.381 349.883 149.021 250.177 87.701 250.177 87.701 250.177" />
                            <polygon points="512 422.735 395.638 422.735 395.638 250.125 347.442 250.125 347.442 469.647 512 469.647 512 422.737 512 422.735" />
                          </svg>
                        </div>
                        <h1 className={`text-2xl font-bold mb-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          APK Builder
                        </h1>
                        <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                          Create Android APKs no-coding required
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="url" className={`font-medium flex items-center gap-2 ${
                          isDarkMode ? "text-white" : "text-slate-900"
                        }`}>
                          <Globe className="w-5 h-5" />
                          Website
                        </Label>
                        <Input
                          id="url"
                          type="url"
                          placeholder="https://YourApp.com"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          className={isDarkMode
                            ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                            : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="appName" className={`font-medium ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          Name
                        </Label>
                        <Input
                          id="appName"
                          type="text"
                          placeholder="YourApp Name"
                          value={appName}
                          onChange={(e) => setAppName(e.target.value)}
                          className={isDarkMode
                            ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                            : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="hostName" className={`font-medium ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                         Domain
                        </Label>
                        <Input
                          id="hostName"
                          type="text"
                          placeholder="YourApp.com"
                          value={hostName}
                          onChange={(e) => setHostName(e.target.value)}
                          className={isDarkMode
                            ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                            : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                          }
                          required
                        />
                        <p className={`text-xs text-center ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                          apk build time averages 1-3 minutes
                        </p>
                      </div>

                      <Button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        variant="ghost"
                        className={`w-full flex items-center justify-center gap-2 ${
                          isDarkMode ? "text-slate-400" : "text-slate-600"
                        }`}
                      >
                        <Palette className="w-4 h-4" />
                        {showAdvanced ? "Hide" : "Show"} Options
                      </Button>

                      {showAdvanced && (
                        <div className="space-y-4 p-4 rounded-lg border" style={{
                          borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                          backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc'
                        }}>
                          <div className="space-y-2">
                            <Label htmlFor="iconChoice" className={`font-medium flex items-center gap-2 ${
                              isDarkMode ? "text-white" : "text-slate-900"
                            }`}>
                              <Image className="w-4 h-4" />
                              App Icon
                            </Label>
                            
                            <div className="grid grid-cols-3 gap-3">
                              {ICON_CHOICES.map((icon) => (
                                <div
                                  key={icon.value}
                                  className={`flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                    iconChoice === icon.value
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
                                  }`}
                                  onClick={() => setIconChoice(icon.value)}
                                >
                                  <img
                                    src={icon.url}
                                    alt={icon.label}
                                    className="w-12 h-12 object-contain mb-2"
                                  />
                                  <span className="text-xs text-center font-medium">
                                    {icon.label}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <select
                              id="iconChoice"
                              value={iconChoice}
                              onChange={(e) => setIconChoice(e.target.value)}
                              className={`w-full p-2 rounded border mt-2 ${
                                isDarkMode
                                  ? "bg-slate-800 border-slate-700 text-white"
                                  : "bg-white border-slate-300 text-slate-900"
                              }`}
                            >
                              {ICON_CHOICES.map((icon) => (
                                <option key={icon.value} value={icon.value}>
                                  {icon.label}
                                </option>
                              ))}
                            </select>
                            
                            <p className={`text-xs ${isDarkMode ? "text-slate-300" : "text-slate-500"}`}>
                              Choose the app icon style
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="themeColor" className={`font-medium flex items-center gap-2 ${
                              isDarkMode ? "text-white" : "text-slate-900"
                            }`}>
                              Theme Color
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="themeColor"
                                type="color"
                                value={themeColor}
                                onChange={(e) => setThemeColor(e.target.value)}
                                className="w-16 h-10 p-1 cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={themeColor}
                                onChange={(e) => setThemeColor(e.target.value)}
                                className={isDarkMode
                                  ? "flex-1 bg-slate-800 border-slate-700 text-white"
                                  : "flex-1 bg-white border-slate-300 text-slate-900"
                                }
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="themeColorDark" className={`font-medium flex items-center gap-2 ${
                              isDarkMode ? "text-white" : "text-slate-900"
                            }`}>
                              Theme Color (Dark Mode)
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="themeColorDark"
                                type="color"
                                value={themeColorDark}
                                onChange={(e) => setThemeColorDark(e.target.value)}
                                className="w-16 h-10 p-1 cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={themeColorDark}
                                onChange={(e) => setThemeColorDark(e.target.value)}
                                className={isDarkMode
                                  ? "flex-1 bg-slate-800 border-slate-700 text-white"
                                  : "flex-1 bg-white border-slate-300 text-slate-900"
                                }
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="backgroundColor" className={`font-medium flex items-center gap-2 ${
                              isDarkMode ? "text-white" : "text-slate-900"
                            }`}>
                              Background Color
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="backgroundColor"
                                type="color"
                                value={backgroundColor}
                                onChange={(e) => setBackgroundColor(e.target.value)}
                                className="w-16 h-10 p-1 cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={backgroundColor}
                                onChange={(e) => setBackgroundColor(e.target.value)}
                                className={isDarkMode
                                  ? "flex-1 bg-slate-800 border-slate-700 text-white"
                                  : "flex-1 bg-white border-slate-300 text-slate-900"
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <p
                        className={`text-xs text-center ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}
                      >
                        <a
                          href="https://apk.jessejesse.com/buildinfo.json"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-pink-500"
                        >
                          About the App
                        </a>
                      </p>

                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-700 hover:to-cyan-800 text-white py-6 rounded-xl text-base font-semibold shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!url || !appName || !hostName}
                      >
                        <Github className="w-5 h-5 mr-2" />
                        Build APK
                      </Button>
                    </form>
                  )}
                </div>

                <div
                  className={`h-8 flex items-center justify-center gap-2 border-t ${
                    isDarkMode
                      ? "bg-slate-900 border-slate-800"
                      : "bg-slate-100 border-slate-300"
                  } rounded-b-[2.5rem]`}
                >
                  <a
                    href="https://github.com/sudo-self/apk-builder-actions/actions/workflows/apk-builder.yml"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <img
                      src="https://img.shields.io/github/actions/workflow/status/sudo-self/apk-builder-actions/apk-builder.yml?color=blue&style=plastic"
                      alt="APK Builder Workflow Status"
                      className="h-4"
                    />
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}






