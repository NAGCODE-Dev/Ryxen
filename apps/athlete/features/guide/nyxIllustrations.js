function renderBaseSvg({ className = '', viewBox = '0 0 420 360', defs = '', body = '' } = {}) {
  return `
    <svg class="${className}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Nyx">
      <defs>${defs}</defs>
      ${body}
    </svg>
  `;
}

function renderWelcomePose(className) {
  return renderBaseSvg({
    className,
    defs: `
      <linearGradient id="nyx-w-body" x1="80" y1="70" x2="280" y2="310" gradientUnits="userSpaceOnUse">
        <stop stop-color="#2E3B50"/>
        <stop offset="0.56" stop-color="#171E29"/>
        <stop offset="1" stop-color="#0E141D"/>
      </linearGradient>
      <linearGradient id="nyx-w-highlight" x1="118" y1="120" x2="225" y2="258" gradientUnits="userSpaceOnUse">
        <stop stop-color="#7EA7F0" stop-opacity="0.46"/>
        <stop offset="1" stop-color="#7EA7F0" stop-opacity="0"/>
      </linearGradient>
    `,
    body: `
      <ellipse cx="220" cy="304" rx="128" ry="26" fill="rgba(10,14,20,0.36)"/>
      <ellipse cx="216" cy="160" rx="118" ry="118" fill="rgba(132,188,255,0.08)"/>
      <path d="M118 282C109 250 119 208 148 183C176 159 219 154 257 170C284 182 304 207 309 243C314 277 296 302 266 312C236 322 197 320 166 309C143 300 125 293 118 282Z" fill="url(#nyx-w-body)"/>
      <path d="M264 190C285 204 300 226 303 250C306 272 299 291 286 304C302 297 318 280 321 253C326 216 302 178 264 160C245 151 222 147 199 149C222 154 246 170 264 190Z" fill="#0B1118" fill-opacity="0.48"/>
      <path d="M177 167C177 133 204 106 237 106C270 106 297 133 297 167C297 201 270 229 237 229C204 229 177 201 177 167Z" fill="url(#nyx-w-body)"/>
      <path d="M193 109L210 68L231 103" fill="#121922"/>
      <path d="M277 109L260 68L239 103" fill="#121922"/>
      <path d="M198 104L210 78L223 100" fill="#1F2A39"/>
      <path d="M272 104L260 78L247 100" fill="#1F2A39"/>
      <ellipse cx="221" cy="170" rx="12" ry="10" fill="#A8C7FF" fill-opacity="0.86"/>
      <ellipse cx="252" cy="170" rx="12" ry="10" fill="#A8C7FF" fill-opacity="0.86"/>
      <ellipse cx="221" cy="170" rx="4" ry="4" fill="#0D1218"/>
      <ellipse cx="252" cy="170" rx="4" ry="4" fill="#0D1218"/>
      <path d="M231 188C236 191 241 191 246 188" stroke="#D7E4FF" stroke-opacity="0.46" stroke-width="3" stroke-linecap="round"/>
      <path d="M144 257C132 240 130 216 143 198C154 182 174 172 196 172C175 183 162 202 159 224C156 242 160 258 170 274L144 257Z" fill="#131A23"/>
      <path d="M171 278C174 250 196 231 220 235C244 239 259 264 252 293L171 278Z" fill="#151C26"/>
      <path d="M271 218C292 213 314 227 320 249C326 271 315 293 296 299C277 305 258 291 254 271C249 249 254 223 271 218Z" fill="url(#nyx-w-body)"/>
      <path d="M130 233C102 228 80 241 74 263C68 285 80 305 101 309C122 313 143 297 146 275C149 255 145 236 130 233Z" fill="#141B25"/>
      <path d="M306 260C346 275 362 313 348 336C340 349 320 352 300 345C321 336 328 308 306 260Z" fill="#10161F"/>
      <path d="M189 130C208 116 229 110 249 113" stroke="url(#nyx-w-highlight)" stroke-width="22" stroke-linecap="round"/>
    `,
  });
}

function renderPresentingPose(className) {
  return renderBaseSvg({
    className,
    defs: `
      <linearGradient id="nyx-p-body" x1="70" y1="98" x2="316" y2="278" gradientUnits="userSpaceOnUse">
        <stop stop-color="#324158"/>
        <stop offset="0.55" stop-color="#18202C"/>
        <stop offset="1" stop-color="#0E141D"/>
      </linearGradient>
      <linearGradient id="nyx-p-ui" x1="248" y1="90" x2="352" y2="190" gradientUnits="userSpaceOnUse">
        <stop stop-color="#95B8FF"/>
        <stop offset="1" stop-color="#5F87D0"/>
      </linearGradient>
    `,
    body: `
      <ellipse cx="208" cy="304" rx="138" ry="24" fill="rgba(10,14,20,0.34)"/>
      <rect x="246" y="88" width="116" height="122" rx="28" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)"/>
      <rect x="262" y="104" width="84" height="12" rx="6" fill="url(#nyx-p-ui)" fill-opacity="0.72"/>
      <rect x="262" y="126" width="70" height="9" rx="4.5" fill="rgba(255,255,255,0.12)"/>
      <rect x="262" y="141" width="86" height="9" rx="4.5" fill="rgba(255,255,255,0.08)"/>
      <rect x="262" y="162" width="42" height="28" rx="14" fill="rgba(126,167,240,0.2)" stroke="rgba(126,167,240,0.26)"/>
      <path d="M93 257C86 219 103 179 137 156C170 133 219 128 264 144C303 158 331 187 336 226C341 260 325 290 291 302C256 314 210 316 168 309C127 302 100 288 93 257Z" fill="url(#nyx-p-body)"/>
      <path d="M115 265C110 230 126 194 157 172C186 152 227 147 265 160C288 168 307 182 319 201C307 177 286 159 258 148C214 131 164 137 129 164C96 189 82 228 90 264C94 284 107 297 123 304C118 294 116 281 115 265Z" fill="#0D141D" fill-opacity="0.52"/>
      <path d="M129 160C129 129 154 104 184 104C214 104 239 129 239 160C239 191 214 216 184 216C154 216 129 191 129 160Z" fill="url(#nyx-p-body)"/>
      <path d="M145 106L159 73L177 101" fill="#141C26"/>
      <path d="M224 106L210 73L192 101" fill="#141C26"/>
      <path d="M150 102L159 81L170 99" fill="#1F2A39"/>
      <path d="M219 102L210 81L199 99" fill="#1F2A39"/>
      <ellipse cx="190" cy="164" rx="10" ry="8" fill="#B6CCFF" fill-opacity="0.86"/>
      <ellipse cx="189" cy="164" rx="3.5" ry="3.5" fill="#0D1218"/>
      <path d="M202 173C208 175 214 174 220 170" stroke="#D7E4FF" stroke-opacity="0.46" stroke-width="3" stroke-linecap="round"/>
      <path d="M211 208C226 202 245 202 263 206C284 210 301 223 309 240C299 226 282 217 262 215C243 212 226 214 210 220L211 208Z" fill="#121922"/>
      <path d="M243 216C268 208 293 222 300 247C307 272 294 293 272 299C250 305 230 291 226 272C223 254 227 224 243 216Z" fill="#141C26"/>
      <path d="M135 224C115 224 99 238 97 257C96 276 107 292 125 296C143 300 160 286 162 269C164 252 155 225 135 224Z" fill="#141C26"/>
      <path d="M289 259C329 274 348 309 338 329C331 343 313 347 294 341C314 332 320 307 289 259Z" fill="#10161F"/>
    `,
  });
}

function renderRestPose(className) {
  return renderBaseSvg({
    className,
    defs: `
      <linearGradient id="nyx-r-body" x1="84" y1="126" x2="316" y2="286" gradientUnits="userSpaceOnUse">
        <stop stop-color="#314056"/>
        <stop offset="0.58" stop-color="#18202B"/>
        <stop offset="1" stop-color="#0D131B"/>
      </linearGradient>
    `,
    body: `
      <ellipse cx="214" cy="306" rx="134" ry="24" fill="rgba(10,14,20,0.34)"/>
      <ellipse cx="224" cy="176" rx="118" ry="110" fill="rgba(132,188,255,0.08)"/>
      <path d="M108 245C108 199 145 162 191 162H220C274 162 318 206 318 260C318 281 301 298 280 298H178C139 298 108 284 108 245Z" fill="url(#nyx-r-body)"/>
      <path d="M159 168C159 138 184 114 214 114C244 114 268 138 268 168C268 198 244 222 214 222C184 222 159 198 159 168Z" fill="url(#nyx-r-body)"/>
      <path d="M173 117L188 82L206 111" fill="#141C26"/>
      <path d="M255 117L240 82L222 111" fill="#141C26"/>
      <path d="M178 112L188 90L199 109" fill="#1F2A39"/>
      <path d="M250 112L240 90L229 109" fill="#1F2A39"/>
      <path d="M196 177C203 182 211 182 218 177" stroke="#D7E4FF" stroke-opacity="0.44" stroke-width="3" stroke-linecap="round"/>
      <path d="M226 177C233 182 241 182 248 177" stroke="#D7E4FF" stroke-opacity="0.44" stroke-width="3" stroke-linecap="round"/>
      <path d="M131 279C155 289 182 294 212 294H274C303 294 318 276 318 259C318 248 314 237 308 228C309 274 280 283 257 283H187C162 283 146 281 131 279Z" fill="#0F161F" fill-opacity="0.52"/>
      <path d="M257 222C286 223 311 239 322 263C333 287 323 313 299 319C274 324 248 306 240 280C232 253 233 222 257 222Z" fill="#111821"/>
      <path d="M112 236C140 242 165 256 187 277" stroke="#7EA7F0" stroke-opacity="0.16" stroke-width="18" stroke-linecap="round"/>
    `,
  });
}

export function renderNyxIllustration({ pose = 'welcome', className = 'nyx-illustration' } = {}) {
  if (pose === 'present') return renderPresentingPose(className);
  if (pose === 'rest') return renderRestPose(className);
  return renderWelcomePose(className);
}
