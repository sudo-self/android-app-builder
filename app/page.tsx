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

// Icon URLs from your domain
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
  const [iconChoice, setIconChoice] = useState("phone") // Default to phone icon
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

  // ... (keep all other useEffect hooks and functions the same)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-800 via-gray-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="relative mx-auto w-[340px] h-[680px] bg-black rounded-[3rem] shadow-2xl border-8 border-[#3DDC84] overflow-hidden">
     
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

          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-black rounded-b-3xl z-10" />

          <div className={`absolute inset-[6px] rounded-[2.5rem] overflow-hidden transition-colors ${
            isDarkMode ? "bg-black" : "bg-gradient-to-b from-slate-50 to-slate-100"
          }`}>     
            {showBootScreen ? (
              <div className="h-full bg-black flex flex-col items-center justify-center rounded-[2.5rem]">
                <div className="animate-in fade-in zoom-in duration-1000">
                  <svg className="w-32 h-32 text-[#3DDC84] mb-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.5 11.5 0 0 0-8.94 0L5.65 5.67c-.19-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85l1.84 3.18C4.8 11.16 3.5 13.84 3.5 16.5V19h17v-2.5c0-2.66-1.3-5.34-2.9-7.02zM7 17.25c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75z" />
                  </svg>
                </div>
                <div className="flex gap-2 mb-4">
                  <div className="w-2 h-2 bg-[#3DDC84] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-[#3DDC84] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-[#3DDC84] rounded-full animate-bounce" />
                </div>
                <p className="text-[#3DDC84] text-sm font-medium animate-pulse">ANDROID</p>
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
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.5 11.5 0 0 0-8.94 0L5.65 5.67c-.19-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85l1.84 3.18C4.8 11.16 3.5 13.84 3.5 16.5V19h17v-2.5c0-2.66-1.3-5.34-2.9-7.02zM7 17.25c-.41 0-.75-.34-.75-.75s.34-.75.75-.75.75.34.75.75-.34.75-.75.75z" />
                    </svg>
                    <button
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className="hover:opacity-70 transition-opacity"
                      aria-label="Toggle theme"
                    >
                      {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
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
                        <span className="ml-2">apk.jessejesse.com</span>
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
                              <div className="w-1 h-3 bg-green-400 rounded-full animate-pulse"></div>
                              <div className="w-1 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-1 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                            <span>Building APK...</span>
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
                          <div className="text-gray-400 text-xs mt-4 pt-2 border-t border-slate-700">
                            <a 
                              href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${githubRunId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:no-underline hover:text-blue-400"
                            >
                              View live build 
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl mb-3 shadow-lg">
                          <Github className="w-8 h-8 text-white" />
                        </div>
                        <h1 className={`text-2xl font-bold mb-1 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          apk.JesseJesse.com
                        </h1>
                        <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                          Github Actions APK Builder
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="url" className={`font-medium flex items-center gap-2 ${
                          isDarkMode ? "text-white" : "text-slate-900"
                        }`}>
                          <Globe className="w-4 h-4" />
                          Website URL
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
                          Application Name
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
                          Domain (.com .net .info .org)
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
                        <p className={`text-xs ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                         build powered by GitHub Actions & Next.js
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
                        {showAdvanced ? "Hide" : "Show"} Advanced Options
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
                            
                            {/* Icon Selection Grid */}
                            <div className="grid grid-cols-3 gap-3">
                              {ICON_CHOICES.map((icon) => (
                                <div
                                  key={icon.value}
                                  className={`flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                    iconChoice === icon.value
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                  }`}
                                  onClick={() => setIconChoice(icon.value)}
                                >
                                  <img
                                    src={icon.url}
                                    alt={icon.label}
                                    className="w-12 h-12 object-contain mb-2"
                                  />
                                  <span className={`text-xs text-center ${
                                    isDarkMode ? "text-white" : "text-slate-900"
                                  }`}>
                                    {icon.label}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Fallback dropdown for accessibility */}
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
                            
                            <p className={`text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
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

                      <p className={`text-xs text-center ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                        build may take 2-5 minutes
                      </p>

                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-6 rounded-xl text-base font-semibold shadow-lg transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!url || !appName || !hostName}
                      >
                        <Github className="w-5 h-5 mr-2" />
                        Build App
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
                    href="https://github.com/sudo-self/apk-builder-actions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <img
                      src="https://img.shields.io/badge/-sudo--self-lightgrey?style=plastic&logo=github"
                      alt="sudo-self"
                      className="h-4"
                    />
                  </a>

                  <a
                    href="https://github.com/sudo-self/apk-builder-actions/actions/workflows/apk-builder.yml"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-80 transition-opacity"
                  >
                    <img
                      src="https://github.com/sudo-self/apk-builder-actions/actions/workflows/apk-builder.yml/badge.svg"
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
