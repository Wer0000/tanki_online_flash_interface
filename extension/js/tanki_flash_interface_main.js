currentLayout = null

function loadStyle(styleFilePath) {
	const path = chrome.extension.getURL(styleFilePath);

	// add new style to head element
	const headElement = document.getElementsByTagName('head')[0];
	headElement.innerHTML += '<link id="customCss" rel="stylesheet" data-tfim_allow_style="" href="' + path + '">';
}

function addBodyToDocument(body) {
	var newElement = document.createElement('div');
	newElement.innerHTML = body.innerHTML;

	var firstChild = document.body.firstChild;
	document.body.insertBefore(newElement, firstChild);
}

function addHeadToDocument(head) {
	const elements = head.querySelectorAll('*');

	for (const element of elements) {

		// add tfim_allow_style atribute to element if the element is css link thing
		if (element.rel == "stylesheet") {
			element.dataset.tfim_allow_style = "";
		}

		document.head.appendChild(element);
	}
}

async function loadHtml(htmlFilePath) {
	const path = chrome.extension.getURL(htmlFilePath);

	// read html file
	const response = await fetch(path);
	const htmlCode = await response.text();

	// create new document from htmlCode
	const parser = new DOMParser();
	const newDocument = parser.parseFromString(htmlCode, 'text/html');

	addHeadToDocument(newDocument.head)
	addBodyToDocument(newDocument.body)
}

function writeToInputBox(inputBoxId, text) {
	const inputBox = document.getElementById(inputBoxId);
	inputBox.value = "";
	inputBox.focus({preventScroll: true});
	document.execCommand('insertText', false, text);
}

const imageCount = 36;
const imageChangeDelay = 5000;
const gooMaxLength = 589;
const speedMultiplierIncrease = 0.01;
const stopIncrease = 10;

class LoadinScreenLayout {
	constructor() {
		this.layoutName = "LoadinScreenLayout";
		this.speedMultiplier = 5;
	}

	async load() {
		loadStyle("css/main.css");

		// the idea of this is to push all original elements out of the window
		await loadHtml("html/push_original_elements_out.html");

		await loadHtml("html/loading.html");

		this.changeImage();
		this.initGooAnimation();
	}

	changeImage() {
		const imageElement = document.getElementById("tip_image");

		if (imageElement == null) {return}

		const randomImage = Math.floor(Math.random() * 36) + 1;
		imageElement.src = chrome.extension.getURL(`images/loading/tip_images/tip (${randomImage}).tnk`);

		setTimeout(this.changeImage, imageChangeDelay);

	}

	initGooAnimation() {
		const element = document.getElementById("goo");
		var elementStyle = element.style;

		// Set the width of the div element to 0 initially
		elementStyle.width = "0px";

		var intervalFunc = () => {
			// Increase the width of the div element
			elementStyle.width = `${parseFloat(elementStyle.width) + 5 / this.speedMultiplier}px`;

			// add speed
			if (this.speedMultiplier < stopIncrease) {
				this.speedMultiplier += speedMultiplierIncrease;
			}

			if (parseFloat(elementStyle.width) <= gooMaxLength) {
				setTimeout(intervalFunc, 8 * this.speedMultiplier);
			}
		}

		intervalFunc();
	}

	finishGooAnimation() {
		this.speedMultiplier = 0.2;
	}


	unload() {
		this.finishGooAnimation();

		setTimeout(() => {
			const element = document.getElementById("loading_main_div");
			element.remove();
		}, 400);
	}
}

class LoginLayout {
	constructor() {
		this.layoutName = "LoginLayout";
	}

	async load() {
		await loadHtml("html/login.html");

		document.getElementById("play_button").onclick = () => {this.playClicked()};
	}

	playClicked() {
		const userName = document.getElementById("username_input").value;
		const password = document.getElementById("password_input").value;
		const rememberMe = document.getElementById("check_box").checked;

		this.tryLogin(userName, password, rememberMe);
	}

	setRememberMeCheckBox(state) {
		const onElement = document.getElementsByClassName("sc-bxivhb bCVAbE");
		const offElement = document.getElementsByClassName("sc-bxivhb knLUAV");

		if(offElement.length == 0 && state == false) {
			onElement[0].click();
			return;
		}
		if (onElement.length == 0 && state == true) {
			offElement[0].click()
			return;
		}

	}

	tryLogin(userName, password, rememberMe) {
		writeToInputBox("username", userName);
		writeToInputBox("password", password);
		this.setRememberMeCheckBox(rememberMe)

		// emulate play button click
		const originalPlayButton = document.getElementsByClassName("sc-bwzfXH jplTTR")[0];
		originalPlayButton.click()
	}

	unload() {
	}
}

function checkForLoginLayout(_currentLayout) {
	if (_currentLayout != null) {
		if (_currentLayout.constructor.name == LoginLayout.name) {
			return;
		}
	}

	const userNameElement = document.getElementById("username");

	if (userNameElement != null) {
		return new LoginLayout();
	}
}

function checkForLoadingLayout(_currentLayout) {
	if (_currentLayout != null) {
		if (_currentLayout.constructor.name == LoadinScreenLayout.name) {
			return null;
		}
	}

	const progressElement = document.getElementById("loading-text");

	if (progressElement != null) {
		return new LoadinScreenLayout();
	}
}

const checkFunctions = [
	checkForLoadingLayout,
	checkForLoginLayout
];

// this function will check that did layout change
function checkLayout() {
	for (const checkFunction of checkFunctions) {
		layout = checkFunction(currentLayout);

		if (layout != null) {

			if (currentLayout != null) {
				currentLayout.unload();
			}

			currentLayout = layout;
			console.log("current layout: " + currentLayout.layoutName)
			layout.load();
		}
	}
}

function disableCss() {
	for (const elementWithStyleAtribute of document.querySelectorAll('[style]')) {
		if (elementWithStyleAtribute.hasAttribute("data-tfim_allow_style")) {
			continue;
		}
		elementWithStyleAtribute.removeAttribute("style");
	}

	for ( i=0; i<document.styleSheets.length; i++) {
		const element = document.styleSheets.item(i).ownerNode;
		if (element.hasAttribute("data-tfim_allow_style")) {
			continue;
		}
		void(document.styleSheets.item(i).disabled=true);
	}
}

function initScrollLock() {
	addEventListener("scroll", (event) => {
		document.body.scrollTop = document.documentElement.scrollTop = 0;
	});
}

function initLayoutChangeDetector() {
	// check for layout change, everytime when dom is modified
	const mutationCallback = (mutationList, observer) => {
		disableCss(); // TODO: this is kinda laggy so change it to disable css only from new elements
		initScrollLock();
		checkLayout();
	}

	// init MutationObserver
	var mutationObserver = new MutationObserver(mutationCallback);
	const config = {attributes: true, childList: true, subtree: true};
	mutationObserver.observe(document, config);
}

function main() {
	console.log("Tanki flash interface mod is running!");
	initLayoutChangeDetector();
}

main();
