$(function(){
	
	if ( !ua.isSP ) {
		PcUtil.initMenu();
	}
	else {
		SpUtil.initMainMenu();
		SpUtil.initSubMenu();
		SpUtil.initTable();
		SpUtil.initScoreSlider();
		
		if ( ua.isLoadCSS == false ) {
			PcUtil.initMenu();
		}
	}
	
});


var PcUtil = {

	//---------------------------------------
	// ビジョン画像の配列
	topBackgrounds: [],

	//---------------------------------------
	// ビジョンタイトルの配列
	topTitleTags: [],
	
	//---------------------------------------
	// ビジョンの表示数
	topVisionViewCount: 5,
	
	visionShuffle :function(){
		
		var i = PcUtil.topBackgrounds.length;
		var j, t, t2;
		while(i){
			j = Math.floor(Math.random()*i);
			t = PcUtil.topBackgrounds[--i];
			PcUtil.topBackgrounds[i] = PcUtil.topBackgrounds[j];
			PcUtil.topBackgrounds[j] = t;
			
			if ( typeof PcUtil.topBackgrounds[0] == "string" ) {
				t2 = PcUtil.topTitleTags[i];
				PcUtil.topTitleTags[i] = PcUtil.topTitleTags[j];
				PcUtil.topTitleTags[j] = t2;
			}
		}
		
		if ( PcUtil.topBackgrounds.length >= PcUtil.topVisionViewCount ) {
			PcUtil.topBackgrounds = PcUtil.topBackgrounds.slice(0, PcUtil.topVisionViewCount );
			if ( typeof PcUtil.topBackgrounds[0] == "string" ) {
				PcUtil.topTitleTags = PcUtil.topTitleTags.slice(0, PcUtil.topVisionViewCount);
			}
		}
		
	},

	//---------------------------------------
	// ビジョンの初期化
	initVision: function(){

		var n = PcUtil.topBackgrounds.length;
		
		var $vision = $("#vision_wrapper");
		var $vTitle = $("#vision_title");
		
		var img, title, images = [];
		
		if ( typeof PcUtil.topBackgrounds[0] == "string" ) {
			title = PcUtil.topTitleTags[0];
			images = PcUtil.topBackgrounds;
		}
		else {
			title = PcUtil.topBackgrounds[0].title;
			for ( var i = 0 ; i < PcUtil.topBackgrounds.length ; i++ ) {
				images.push( PcUtil.topBackgrounds[i].img_pc );
			}
		}
		
		if ( title ) {
			$vTitle.find(".text").html( title );
			$vTitle.show();
		}
		else {
			$vTitle.hide();
		}
		
		$vision.backstretch( images, {
			fade: 800,
			centeredY : false
		});
		
		if ( n > 1 ) {
			
			var e = "<ul>";
			for ( var i = 0 ; i < n ; i++ ) {
				if ( i == 0 ) {
					e += "<li class='current'>" + i + "</li>";
				}
				else {
					e += "<li>" + i + "</li>";
				}
			}
			e += "</ul>";
			var $p = $("#vision_pointer").append(e).find("li");
			
			$vision.find(".next").click(function(){
				$vision.backstretch("next");
			});
			
			$vision.find(".prev").click(function(){
				$vision.backstretch("prev");
			});
			
			$vision.on("backstretch.before", function (e, instance, i) {
				$p.filter(".current").removeClass("current");
				$p.eq(i).addClass("current");
				
				var title = ( typeof PcUtil.topBackgrounds[i] == "string" ) ? PcUtil.topTitleTags[i] : PcUtil.topBackgrounds[i].title;
				
				if ( title ) {
					$vTitle.find(".text").html( title );
					$vTitle.show();
				}
				else {
					$vTitle.hide();
				}
			});
			
			$p.click(function(){
				if( $(this).hasClass("current") ) return false;
				$vision.backstretch("show", $(this).text() );
			})
			
		}
		else {
			
			$vision.find(".next").hide();
			$vision.find(".prev").hide();
			
		}
		
		



	},

	//---------------------------------------
	// メインメニューの初期化
	initMenu: function(){
		
		if ( ua.isTablet || ua.isSP ) {
			
			$("#header_nav").find("nav").find(".menu").find("a").click( function(){
				event.stopPropagation();
			} );
			
			$("#header_nav").find("nav").find("li").click(function(){
				
				if ( $(this).hasClass("open") ) {
					if ( $(this).hasClass("search") ) return false;
					PcUtil.menuClose( this );
					$(this).removeClass("open");
				}
				else {
					var $close = $(this).parent().find(".open");
					if ( $close ) {
						PcUtil.menuClose( $close );
						$close.removeClass("open");
					}
					PcUtil.menuOpen(this);
					$(this).addClass("open");
				}
				
				return false;
			})
		}
		else {
			$("#header_nav").find("nav").find("li").hover( function(){
				PcUtil.menuOpen( this );
			},
			function(){
				PcUtil.menuClose( this );
			});
		}

	},
	
	menuOpen: function( _tg ) {
		
		var _this = _tg;
		
		$(_this).addClass("current");
		var $this = $(_this).find(".unit")
				.stop()
				.css("z-index",100);
		if ( $this.hasClass("menu") ) {
			$this.stop().slideDown(300,"easeOutQuart");
			$this.find("a").each(function(i){
				$(this).stop().stop().css("opacity",0).delay(i*30+200).animate({"opacity":1},200,"easeOutQuad");
			});
		}
		else {
			$this.fadeIn(200,"easeOutQuart");
		}
		
	},
	
	menuClose: function( _tg ) {
		
		var _this = _tg;
		
		$(_this).removeClass("current");
		var $this = $(_this).find(".unit")
				.stop()
				.css("z-index",10);
		if ( $this.hasClass("menu") ) {
			$this.stop().slideUp(400, "easeOutQuart");
		}
		else {
			$this.stop().fadeOut(200, "easeOutQuart");
		}
		
	}


};



var SpUtil = {

	//---------------------------------------
	// リーグタブの初期表示
	defaultLeague : "c",

	//---------------------------------------
	// ビジョンの初期化
	initVision : function() {

		var n = PcUtil.topBackgrounds.length;
		var e = "";

		e = '<div id="flick_container">';
		for ( var i = 0 ; i < n ; i++ ) {
			if ( typeof PcUtil.topBackgrounds[i] == "string" ) {
				e += '<div class="unit">' +
					'<img src="' + PcUtil.topBackgrounds[i] + '" alt=""/>' +
					'<div class="caption">' + PcUtil.topTitleTags[i] + '</div>' +
					'</div>';
			}
			else {
				e += '<div class="unit">' +
					'<img src="' + PcUtil.topBackgrounds[i].img_sp + '" alt=""/>' +
					'<div class="caption">' + PcUtil.topBackgrounds[i].title + '</div>' +
					'</div>';
			}
		}
		e += '</div>';

		var $wrapper = $("#vision_wrapper");
		$wrapper.prepend(e)
			.find("#flick_container").css("width", n*100+"%")
			.find(".unit").css("width", 100/n+"%");

		var h = 0;
		$wrapper.find(".caption").each(function(){
			var thisH = $(this).height();
			if ( h < thisH ) {
				h = thisH;
			}
		});
		$wrapper.find(".caption").height( h );
		
		if ( n > 1 ) {
			
			e = "<ul>";
			for ( i = 1 ; i <= n ; i++ ) {
				if ( i == 1 ) {
					e += "<li class='current'>" + i + "</li>";
				}
				else {
					e += "<li>" + i + "</li>";
				}
			}
			e += "</ul>";
			var $p = $("#vision_pointer").append(e).find("li");
			
			$wrapper.flickSimple({
				onChange : function() {
					$p.filter(".current").removeClass("current");
					$p.eq( this.page-1 ).addClass("current");
				}
			});
			var fs = $wrapper.flickSimple();
			
			$p.click(function(){
				if( $(this).hasClass("current") ) return false;
				fs.goTo( $(this).text() );
			});
			
		}
		



	},

	//---------------------------------------
	// メインメニューの初期化
	initMainMenu: function() {

		$("#sp_menu").click(function(){

			var $nav = $("#header_nav").find("nav");

			//close
			if ( $(this).hasClass("opened") ) {
				$(this).removeClass("opened");
				if( ua.isiOS ) {
					$("body").css({ "position": "", "width": "", "height": "" });
				}
				else {
					$("#layout").css({ "overflow": "", "width": "", "height": "" });
				}
				$nav.slideUp(300,"easeOutQuad");
			}
			//open
			else {
				var h = document.documentElement.clientHeight;
				var w = document.documentElement.clientWidth;
				$(this).addClass("opened");
				if ( ua.isiOS ) {
					$("body").css({ "position": "fixed", "width": w+"px", "height": h+"px" });
				}
				else {
					$("#layout").css({ "overflow": "hidden", "width": w+"px", "height": h+"px" });
				}
				
				if ( $("#header_score").length > 0 ) {
					h = h - 60 - $("#header_score").height();
				}
				else {
					h = h - 60;
				}
				
				$nav.height(h).show().scrollTop(0).hide();
				$nav.slideDown(300,"easeOutQuad");
			}


		});

	},

	//---------------------------------------
	// サブメニューの初期化
	initSubMenu: function() {

		$(".third_menu_ttl").click(function(){
			$(this).next().stop().slideToggle(300,"easeOutQuad");
		});

	},
	
	initScoreSlider : function(){
		
		$("#header_score").flickSimple({
			snap: 0
		})
		
	},


	//---------------------------------------
	// テーブル変換
	initTable: function() {

		//table変換
		$(".sp_table").find("table").each(function(){

			var $table = $(this);
			$table.find("tbody").find("th").css("white-space","normal");
			
			$(this).find("thead").find("th").each(function ( i ) {

				var headText = $(this).text();

				$table.find("tbody").find("tr").each(function(){
					$(this).children().each(function(n) {
						if ( n == i ) {
							$(this).filter("td").each(function(){
								$(this).wrapInner("<div class='table_list_value'></div>").prepend("<div class='table_list_title'>" + headText + "</div>");
							});
						}
					});
				});
			});

		});

		$(".sp_table2").find("table").each(function(){

			var $table = $(this);

			$(this).find("thead").find("th").each(function ( i ) {

				var headText = $(this).text();

				$table.find("tbody").find("tr").each(function(){
					$(this).children().each(function(n) {
						if ( n == i ) {
							$(this).filter("td").each(function(){
								$(this).wrapInner('<table class="sp_table2_inner"><tr><td></td></tr></table>').find("tr").prepend("<th>" + headText + "</th>");
							});
						}
					});
				});
			});

		});

		window.onload = function(){
			$('.scroll_wrapper').flickSimple({
				snap: ''
			});
		};

	},


	//---------------------------------------
	// リーグタブの初期化
	initLeagueTab : function() {

		var $tab, $wrapper;

		var $tabs = $("#cepa_title").children();
		var $info = $("#league_info_wrapper").find(".wrap").children();

		if ( Math.random() > 0.5 ) {
			this.defaultLeague = "p";
		}

		$tabs.click(function(){
			var league = $(this).attr("data-league");

			$tabs.removeClass("current")
				.filter("." + league).addClass("current");

			$info.hide()
				.filter("#"+league+"_info").show();

		});

		if ( this.defaultLeague == "c" ) {
			$tabs.filter(".central").click();
		}
		else {
			$tabs.filter(".pacific").click();
		}

	}


};


var PcSpUtil = {

	//---------------------------------------
	// ページナビのアクティブ設定
	BodySliceValue : 0,
	ListSliceValue : 0,
	NavClassName : ".page_nav",


	initPageNavCurrent : function(){

		var page = $("body").attr('id');
			page = page.slice(PcSpUtil.BodySliceValue);

		$(PcSpUtil.NavClassName).find("li").each(function(){

			var id = $(this).attr('id');
				id = id.slice(PcSpUtil.ListSliceValue);

			if( page == id ){

				var e = $(this).find("a").text();
				var img = $(this).find("img");
				$(this).addClass('current').text(e).append(img);

			}

		});

	}

};
