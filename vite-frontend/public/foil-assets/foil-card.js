const Pt = (o, e = -20, t = 20) => Math.min(Math.max(o, e), t)

let MvAuto = false
let CurrentDeg = 0

function OrientCard(mvX, mvY) {
  if (!MvAuto) {
    const Ydeg = 90 - (mvX * 90) / (document.body.clientWidth / 2)
    const Xdeg = -90 + (mvY * 90) / (document.body.clientHeight / 4)
    const acard = document.getElementById('acard')
    if (!acard) return

    acard.style.setProperty('--rx', Ydeg + 'deg')
    acard.style.setProperty('--ry', Xdeg / 2 + 'deg')
    acard.style.setProperty('--mx', 40 - Ydeg * 5 + '%')
    acard.style.setProperty('--my', 5 + Xdeg + '%')
    acard.style.setProperty('--tx', Ydeg + 'px')
    acard.style.setProperty('--ty', Xdeg / 10 + 'px')
    acard.style.setProperty('--pos', Xdeg * 5 + '% ' + Ydeg + '% ')
    acard.style.setProperty('--posx', 50 + Xdeg / 10 + Ydeg + '% ')
    acard.style.setProperty('--posy', 50 + Ydeg / 10 + Xdeg / 10 + '% ')
    acard.style.setProperty('--hyp', Pt(Math.sqrt((mvX - 50) ** 2 + (mvY - 50) ** 2) / 50, 0, 1))
  }
}

function rotate() {
  if (MvAuto) {
    CurrentDeg += 2
    if (CurrentDeg > 180) CurrentDeg = -180
    const acard = document.getElementById('acard')
    if (!acard) return

    acard.style.setProperty('--rx', CurrentDeg + 'deg')
    acard.style.setProperty('--mx', CurrentDeg * 10 + '%')
    acard.style.setProperty('--my', CurrentDeg + '%')
    acard.style.setProperty('--pos', CurrentDeg * 5 + '% ' + CurrentDeg + '% ')
    acard.style.setProperty('--posx', 50 + CurrentDeg / 2 + '% ')
    acard.style.setProperty('--posy', 50 + CurrentDeg / 10 + '% ')
    acard.style.setProperty('--hyp', Pt(Math.sqrt(CurrentDeg * CurrentDeg) / 50, 0, 1))
  }

  setTimeout(rotate, 40)
}

function orientationhandler(evt) {
  if (!evt.gamma && !evt.beta) {
    evt.gamma = -(evt.x * (180 / Math.PI))
    evt.beta = -(evt.y * (180 / Math.PI))
  }

  const infoBox = document.querySelector('.PNL_Infos')
  if (infoBox) {
    infoBox.innerHTML = `A:${evt.alpha?.toFixed(2)}°; B:${evt.beta?.toFixed(2)}°; G:${evt.gamma?.toFixed(2)}°`
  }

  OrientCard(document.body.clientWidth / 2 + evt.gamma * 2, document.body.clientHeight / 2 - evt.beta * 4)
}

window.initFoilCard = function () {
  const acard = document.getElementById('acard')
  if (!acard) return

  MvAuto = false
  CurrentDeg = -180

  acard.style.setProperty('--ry', '0deg')
  acard.style.setProperty('--rx', '0deg')
  acard.style.setProperty('--tx', '0px')
  acard.style.setProperty('--ty', '0px')

  if ('ontouchstart' in window && window.DeviceOrientationEvent) {
    const label = document.getElementById('mouseMoveLabel')
    if (label) label.innerHTML = 'Phone move'
    window.addEventListener('deviceorientation', orientationhandler, false)
    window.addEventListener('MozOrientation', orientationhandler, false)
  } else {
    const label = document.getElementById('mouseMoveLabel')
    if (label) label.innerHTML = 'Mouse move'
  }

  acard.addEventListener('mousemove', (e) => {
    const infoBox = document.querySelector('.PNL_Infos')
    if (infoBox) {
      infoBox.innerHTML = `M.x:${e.clientX}px; M.y:${e.clientY}px`
    }
    OrientCard(e.clientX, e.clientY)
  })

  setTimeout(rotate, 40)
}

window.adaptCardType = function (e) {
  const acard = document.getElementById('acard')
  if (acard) acard.setAttribute('data-rarity', e.value)
}

window.changeCard = function (e) {
  const img = document.getElementById('card_front_pic')
  if (img) img.setAttribute('src', e.value)
}

window.ChangeCardMove = function (e) {
  if (e.id === 'mouseMove') {
    MvAuto = false
  } else {
    MvAuto = true
    window.initFoilCard()
  }
}
