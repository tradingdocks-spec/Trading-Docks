require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'TradingDocksVisionOcr'
  s.version        = package['version']
  s.summary        = 'Trading Docks local Apple Vision OCR module'
  s.description    = 'A local Expo module that runs Apple Vision OCR on captured Magic card still images.'
  s.license        = 'UNLICENSED'
  s.author         = 'Trading Docks'
  s.homepage       = 'https://tradingdocks.com'
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://example.invalid/trading-docks-vision-ocr.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
